# Cosmos Mongo API Index Management

## Context

CAMS declares Cosmos DB for MongoDB collection indexes as Infrastructure-as-Code in Bicep (see
[Azure Resource Manager](AzureResourceManager.md)), and that remains the default and preferred
approach for the overwhelming majority of indexes in the system.

However, the Cosmos DB for MongoDB API's Bicep/ARM resource for collection indexes only supports
ascending sort direction — it has no way to express a mixed-direction composite index (e.g., one
field sorted descending alongside another sorted ascending). Some query patterns genuinely require
such an index; a case in point is a trustee's case list, which must sort by filing date descending
while breaking ties by case identifier ascending (case identifiers embed a division code, so
reversing that tiebreak would sort divisions in the wrong order — sorting the identifier descending
is not an acceptable substitute).

This is a hard limitation of the ARM resource, not a Bicep authoring gap: no encoding of the index
specification (embedded direction markers, prefix conventions, or index option overrides) is
accepted by the resource provider. It was confirmed empirically, by deploying a disposable scratch
collection through each candidate encoding and inspecting what Cosmos actually materialized, that
none succeed — the resource silently either misinterprets the input as a literal (and incorrect)
field name or ignores it outright.

The same experimentation also settled a related question: what happens when an index a collection
resource is expected to manage is left out of its declared index list. ARM's declarative
reconciliation treats a collection's declared index list as the complete desired state — any index
present on the live collection but absent from that list is dropped on deploy. This meant that a
collection whose Bicep declaration otherwise covers every ascending index, but simply omits the one
index that cannot be expressed, would have that missing index rebuilt from scratch on every
deployment, since something has to keep re-creating it between deploys and Bicep would keep
discovering it as an undeclared addition to remove. On a large, growing collection, that recurring
rebuild is a real and needless cost. Testing showed that omitting a collection's entire index
declaration from Bicep, rather than a partial one, avoids this problem: Cosmos leaves an
already-correct set of indexes alone when Bicep is not managing indexes on that collection at all,
so re-establishing the same indexes on every deploy costs nothing once they already exist.

**Alternatives considered:**

- _Keep every expressible index declared in Bicep, and manage only the one non-expressible index
  out-of-band._ Rejected because it does not avoid the recurring-rebuild problem — the coexistence
  of Bicep-managed and out-of-band-managed indexes on the same collection still produces a rebuild
  of the out-of-band index on every deployment.
- _Run index reconciliation on a recurring schedule, independent of deployment._ Rejected because it
  introduces a window, between a deployment and the next scheduled run, during which a required
  index could be missing and a dependent query could degrade or fail for end users. Index management
  must stay tied to the deployment that could affect it, not decoupled from it.

## Decision

For a collection where at least one required index cannot be expressed in the Cosmos Mongo API's ARM
resource, we will manage that collection's entire index set outside of Bicep, as part of the
deployment pipeline itself, rather than splitting index ownership between Bicep and an out-of-band
mechanism. Indexes are re-established idempotently on every deployment; an index that already exists
in the desired form is left untouched.

This is treated as a deliberate, narrow exception to Infrastructure-as-Code index management,
applied only to collections that need it — the default remains declaring indexes in Bicep.

## Status

Accepted

## Consequences

The collections this exception applies to lose the review visibility and drift protection that comes
from having their full index set declared alongside the rest of the collection's
Infrastructure-as-Code; their index set is defined and changed in application-deployment tooling
instead, and future changes to it need to be made and reviewed there rather than in the Bicep
template.

Because index re-establishment runs as part of every deployment and is confirmed idempotent, it
introduces no recurring cost during normal operation and needs no separate operational process. The
first time a new index is introduced under this pattern, or introduced to a new environment, the
underlying index build still has its usual one-time cost proportional to collection size — this
decision addresses recurring cost on already-established indexes, not first-time creation cost.

This same limitation and pattern will recur for any future collection whose required sort order
cannot be expressed as an ascending-only composite index; this decision documents the general
pattern so it doesn't need to be re-litigated case by case.
