# Trustee Matching Pipeline

## Context

Trustee identity matching — deciding which CAMS trustee record, if any, corresponds to a trustee
record from a legacy source system (ACMS professional records, DXTR case-appointment parties) —
started as a small set of sequential checks and grew, improvement by improvement, into a deeply
nested branching function. Each new matching signal — a stricter candidate filter, a data-quality
normalization, a new fallback tier — was added as another conditional branch, another argument
threaded through existing calls, or another layer of nesting.

This growth pattern had two costs. First, testing a single branch in isolation required mocking most
of the surrounding call graph, since a branch was only reachable by first satisfying every branch
that preceded it. Second, reasoning about the function as a whole required holding the entire branch
tree in mind, since a new signal's correct placement depended on which existing branches it had to
run before, after, or in place of.

Three properties of the problem shaped the decision beyond "reduce branching":

- **The source data is dirty.** Legacy records carry misfiled fields (a full name in the surname
  field), sentinel values that stand in for missing data, typographic and transcription errors,
  reordered name parts, and records so sparse they carry only a name. Matching must both correct for
  data quality and weigh graded identity evidence, and it must remain auditable — a reviewer needs
  to see why any given outcome was reached.
- **Signals differ by orders of magnitude in cost.** Some comparisons are cheap and decisive; some
  candidate retrievals — particularly edit-distance and fuzzy searches — are expensive. Running
  every signal against every record is wasteful when a cheap, high-confidence resolution is
  available.
- **The stages of matching were named inconsistently.** The same step was described with different
  words in different places, which made it hard to agree on where a new signal belonged or what a
  stage was responsible for. A shared vocabulary is itself part of the decision.

No alternative to changing the architecture was seriously considered: continuing to add branches to
the existing structure was rejected because branching complexity was the problem motivating the
decision, not a symptom to route around.

## Decision

Trustee matching is modeled as a pipeline: an ordered sequence of independent stages, each operating
on one shared, uniform state shape rather than on each other's function signatures. The shared state
carries the source record being matched, a growing collection of CAMS candidates under
consideration, and a terminal-outcome slot. A stage may add a candidate or add evaluative
information to an existing candidate, but never removes a candidate from the shared state — so a
candidate's presence depends only on whether some stage ever proposed it, never on the order stages
ran in. Every evaluative contribution is recorded incrementally alongside what already exists,
preserving the full sequence of evaluations a candidate accumulated.

### A uniform functional shape

Every pool-level stage shares exactly one signature: `(state) => state`, with no exceptions. This is
a deliberate, Lisp-style design choice, not an incidental convention — a fixed input/output shape is
what lets stages compose as a plain ordered list, be written and tested in isolation, and be
reordered or added to without touching any other stage's code. A stage is a pure computation over
its input state: deterministic, free of I/O, and free of mutation of the source or candidate records
it was handed as raw input. The one sanctioned exception is a RECALL stage's own repository call,
whose failure lands on the state's error slot rather than throwing (see "Processing failure" below)
— RECALL is the sole boundary anywhere in the pipeline where non-determinism or I/O is permitted to
enter at all. This is a pragmatic relaxation of strict purity, not an oversight: forbidding RECALL's
own repository call would make retrieval impossible, so the rule is "no I/O or non-determinism
outside RECALL," not "no I/O anywhere."

SCORE, when it runs against a single already-discovered candidate rather than the whole pool, uses
its own distinct, narrower, equally uniform signature: `(sourceNormalized, candidate) => candidate`.
This is not the same signature as a pool-level stage, and that is intentional — a per-candidate
scorer's only inputs are the normalized source record and the one candidate it is scoring, so its
signature says exactly that, rather than accepting the whole pipeline state (including every other
candidate, the terminal-outcome slots, and the raw source record) only to ignore almost all of it.
`sourceRaw` deliberately never appears in this signature: a candidate scorer that needs a raw,
unnormalized field (for example, a legacy address string that hasn't been parsed, or a lastName
before it was reduced to its comparison token) reads it from a passthrough clone already carried on
`sourceNormalized`, never from `sourceRaw` directly, so `sourceRaw` stays structurally protected
from mutation no matter what a scorer does. A per-candidate scorer composes with other per-candidate
scorers the same way pool-level stages do — as a plain ordered list, reduced left to right, each
scorer's returned candidate feeding the next — mirroring the pool-level runner's own shape one level
down, but without a terminal-outcome guard: no per-candidate scorer ever short-circuits the
remaining scorers, because a candidate's disqualification is data recorded on it, not a control-flow
signal the way the pipeline state's `match`/`skip`/`error` is at the pool level. Every candidate
runs through the full per-candidate scorer sequence exactly once, at the moment it is discovered —
not through a separate, later pool-wide SCORE pass — so by the time a candidate is visible to any
pool-level stage, it is already fully scored, and RESOLVE stages are pure readers of that history
rather than triggers for new computation.

Purity here means no I/O, no randomness, and no dependence on anything outside the function's own
arguments — not the stricter sense of never mutating anything reachable from those arguments. A
scorer records its findings by mutating the one candidate it was handed (via a shared accumulator,
appending a score or a disqualifier to that candidate's own evaluation history) and then returns
that same candidate, rather than deep-cloning the candidate and every nested structure on every
single scorer call. This is a deliberate, narrow, and only sanctioned exception to full
immutability: cloning a growing evaluation history on every one of dozens of per-candidate scorer
calls, for every candidate, on every record, has real computation and memory costs that buy nothing
here, since a candidate is never read by more than one logical owner at a time and its scoring
history is additive, never revised. Full structural immutability was considered and rejected for
this reason. What purity guarantees is determinism and the absence of I/O — given the same inputs, a
scorer produces the same recorded evidence every time, and evaluating it never touches a database, a
clock, or any other outside-the-arguments state — not that no object anywhere in memory is ever
mutated in place.

### Raw and normalized are both kept, and which one to read is a rule

NORMALIZE does not overwrite the source record. The shared state carries the raw source exactly as
the legacy system supplied it _and_ the normalized form derived from it, side by side, so the
persisted evidence shows what was received next to what was derived from it. A recovery baked into
the only copy of a name is a recovery no reviewer can audit afterward.

Which one to read is a rule, not a judgment call:

> **Every SCORE and RESOLVE comparison reads the normalized source and the normalized candidate.**
> Raw fields exist to be persisted and to be normalized from — not to be compared against.

RECALL is the one role that reads a raw-shaped record, because retrieval helpers shared with other
dataflows take that shape. That translation happens at a single designated point, so no scorer or
resolver needs to know it exists.

Normalization is a sequence of transforms — recovering misfiled or corrupted fields, stripping
administrative markers and punctuation, reducing a surname to its identifying token. Declining the
last of them is not grounds for reading the raw field, which declines all of them: read the
normalized value, and apply any wanted strictness to the other side of the comparison. A stage that
does decline a transform names which one, and why, in its own code; the default is otherwise
indistinguishable from an oversight.

The one sanctioned instance: `isExactLastNameMatch`, gating three sole-candidate RESOLVE stages,
strips administrative markers on both the source and candidate lastName but declines the final
token-reduction transform, symmetrically, on both sides. Reducing both sides collapses a genuinely
different, unrelated surname truncated to its first hyphen segment ("Schwartz-Albright") into the
same candidate as an unrelated "Schwartz" — the sole-candidate gate these stages depend on requires
that collision to never happen. This is not reading `sourceRaw` — it reads the marker-stripped
value, which stops one transform short of the full normalized form.

Testing obligation: state built directly, without running NORMALIZE, leaves raw and normalized
identical, and a comparison reading the wrong one passes. Any stage comparing names needs at least
one fixture whose raw and normalized forms differ.

### Ubiquitous language

Stages are described by the semantic role they play. A stage plays one or more of these roles:

- **RECALL** — retrieving candidate trustees from CAMS as-is, without normalization.
- **NORMALIZE** — applying data-quality rules and string manipulation (lowercasing, stripping
  punctuation, resolving sentinel values, recovering misfiled or corrupted fields, reducing a
  surname to its identifying token) to source and candidate fields so that comparisons are
  meaningful.
- **SCORE** — producing an up-or-down signal from a comparison of normalized fields. Name,
  geography, and string-similarity measures (for example Jaro-Winkler and Levenshtein distance) all
  contribute to SCORE.
- **MEMOIZATION** — recording a function's inputs and outputs during a run so a signal, its
  parameters, and its result remain inspectable later and are not recomputed.
- **RESOLVE** — reasoning over a candidate's accumulated scores to reach one terminal outcome.

### Naming convention

A stage's name states its role(s) as a leading verb, so the name and the role are never two things
to hold in mind at once: a RECALL name leads with retrieval, a SCORE name leads with comparison (an
annotation that never gates a terminal outcome is named as a recording, distinguishing a diagnostic
from a real SCORE), a RESOLVE name leads with the resolution. A stage that straddles roles (see
"These roles are semantic, not a rigid structure" above) states both leading verbs, in the order
they occur. A score's key follows the same rule at the field level — a boolean comparison is keyed
as a predicate so the recorded evidence reads the same way the stage that produced it does.

A RESOLVE reaches exactly one of four outcomes:

- **INCOMPARABLE** — the source record carries no identity to match at all: an administrative
  placeholder, or a record the source system has disavowed. Candidate quality cannot be assessed
  because there is no person to assess it against. This differs from AMBIGUOUS in kind: the blocker
  is an absent subject, not competing evidence.
- **MATCH** — a single candidate is confirmed by corroborating evidence beyond the name (a
  high-quality candidate).
- **NO MATCH** — no candidate reaches confirmation (no high-quality candidate).
- **AMBIGUOUS** — two or more candidates are each independently confirmed by corroborating evidence,
  and nothing distinguishes them (competing high-quality candidates).

INCOMPARABLE and MATCH are terminating outcomes: once either is reached, the pipeline short-circuits
and every later stage takes no action. NO MATCH and AMBIGUOUS are settled only after the resolving
stages are exhausted, since confirming the absence of a single high-quality candidate — or the
presence of more than one — requires that every resolving stage has had its chance.

INCOMPARABLE is carried on the shared state's own skip slot rather than a fourth dedicated slot, and
is reached by exactly one stage, at the very front of the pipeline, before any retrieval is
attempted — there is no point paying for candidate discovery against a record that names no one. It
is deliberately scoped to records carrying _no identity_, not to records carrying a _thin_ one: a
real surname with no corroborating data (no address, a sentinel phone value) describes a real person
and proceeds to matching. What becomes of that population is covered under "Resolving on thin
evidence" below.

### The four outcomes and the persisted dispositions

The four RESOLVE outcomes are the pipeline's internal vocabulary. What is persisted per source
record is a _disposition_ — six of them — and the two do not map one-to-one: two dispositions
describe states the pipeline never resolved at all.

| Outcome                         | Disposition   | Notes                                                                                                          |
| ------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------- |
| MATCH                           | `auto-linked` |                                                                                                                |
| NO MATCH                        | `no-match`    | Also covers a pool where no candidate cleared name matching — zero real evidence, not competing evidence       |
| AMBIGUOUS                       | `ambiguous`   | Competing candidates                                                                                           |
| INCOMPARABLE                    | `skipped`     |                                                                                                                |
| _(none — processing failure)_   | `error`       | Orthogonal to resolution in kind, but dominant in precedence; see below                                        |
| _(none — write-time collision)_ | `conflict`    | The professional ID was already linked to a different trustee; detected at persistence, not by a RESOLVE stage |

Whether an `ambiguous` record's candidates look like duplicate CAMS records of one person, rather
than two different people, is a **separate boolean field** (`suspectDuplicateCamsTrustee`), not a
disposition — set when two or more name-qualifying candidates share a phone, an email, or a street
address with _each other_. Address is the load-bearing signal: a trustee entered twice commonly
shares an address even when phone and email differ or are missing on one side. Keeping it a field
rather than a disposition lets a caller filter on either axis independently.

When more than one outcome slot is set, the disposition resolves in the order error → skip → match →
ambiguity. An evaluation that failed is never reported as a resolution, even if an earlier stage had
already claimed one.

A processing failure is a separate, orthogonal state: it means evaluation could not be completed,
not that a resolution was reached. A RECALL stage's own retrieval can fail for reasons that have
nothing to do with the source record's identity — a database timeout, a transient network fault —
and that failure is not itself evidence about whether a candidate matches. A RECALL stage catches
its own retrieval failure and records it directly on the shared state's error slot, rather than
throwing; every later stage is written to check for a terminal outcome (a resolution, a skip, or an
error) before doing any work, so a stage never needs its own special-cased awareness that an earlier
stage failed. This is a deliberate choice not to use thrown exceptions as pipeline control flow: a
call site inspects the state graph's error slot explicitly to decide what happened and what to do
next, the same way it already inspects the resolution slot, rather than wrapping calls in a
try/catch it must remember to add correctly.

A per-candidate scorer is expected to never throw at all — it is pure arithmetic and string
comparison over data already in hand, with no I/O of its own to fail — but a genuinely unanticipated
failure (malformed data reaching a comparison that assumed a well-formed shape) is still caught at
the boundary where a candidate is discovered and immediately scored, the one place that already
holds the shared pipeline state, and recorded on the state's error slot the same way a RECALL
stage's own failure is. This keeps the "no I/O or non-determinism outside RECALL" rule intact for
the scorer itself — the scorer's own signature never carries an error channel — while still giving a
truly unexpected failure exactly one place to surface, rather than letting it propagate as a raw
exception through code that was written assuming it never would. An enclosing try/catch still exists
at the outermost call as a further backstop against a genuinely unanticipated failure, but it is not
where this design expects failures to normally surface.

### Comparability

Comparability — whether enough data exists to corroborate an identity — is assessed on both sides,
and neither side's deficiency ends the pipeline. A data-deficient candidate (a CAMS trustee lacking
corroborating data such as address or phone) is annotated as not comparable and excluded from
confirmation; evaluation continues against the other candidates. A data-deficient source (a record
carrying only a name) is likewise annotated, and every ordinary resolving stage treats that
annotation as an exclusion — leaving the record to NO MATCH or AMBIGUOUS unless a last-resort stage
claims it (see "Resolving on thin evidence").

Neither is INCOMPARABLE, which is not about deficient data at all: it is reached only when the
record names no person to match.

Two rules follow from requiring corroboration for a MATCH. First, a name-only source is never run
through the fuzzy or otherwise expensive retrieval tiers: with no corroborating data available, a
fuzzy name match cannot be confirmed and only manufactures false positives. Second, a sole
exact-name candidate is not, on its own, a MATCH. CAMS is an open population — the identity a source
refers to may be a trustee not yet recorded in it — so the absence of other same-name candidates is
not evidence that the one present is correct. Corroborating evidence beyond the name is what earns a
MATCH, so a source carrying only a name does not reach MATCH through any ordinary resolving stage:
every one of them treats a source with no comparable contact data as an automatic exclusion,
regardless of how strong the name match is.

### Resolving on thin evidence

One population falls outside that rule: a source record naming an actual person, matching exactly
one candidate on name, with no corroborating data on the source side at all — not missing one field,
but structurally uncomparable (no address, a sentinel in place of the phone). Requiring one more
corroborating signal is not available here; there is nothing left to ask for.

These resolve, through a small set of last-resort stages constrained as follows:

- **They run last, as a group.** Nothing in the group runs until nothing outside it could resolve
  the record. Every ordinary resolving stage already excludes this candidate shape, so ordering the
  group last forfeits nothing.
- **They are collected in one list, not interleaved.** "What does this pipeline trust on thin
  evidence?" has one place to read. Adding, removing, or reordering one leaves the main sequence's
  validated ordering untouched.
- **They are internally ordered by decreasing evidence strength**, as the main sequence is.
- **Each names, in its own code, the risk it accepts and the backtest population behind it** —
  including the residual risk no available signal can catch: an exact name match belonging to a
  different real person.

The trade-off: a small, measured number of links rest on name evidence alone, against leaving a
known and reviewable population permanently unresolved. Any change to this group is validated
against the backtest population before landing.

### Disqualifiers

A SCORE stage's ordinary output — a value, a threshold, and a pass/fail — cannot distinguish
"actively checked and found a conflict" from "never checked at all"; both simply fail to contribute
a passing signal. A disqualifier is a distinct, affirmative unit of evidence a SCORE stage records
only when it has positive proof against a candidate (for example, the source and candidate addresses
were both present and specific, and disagreed on every one of city, state, and zip — not merely
unparseable or uncompared). Recording this separately from an ordinary failed score lets a RESOLVE
stage require "nothing found a reason to doubt this candidate" as an explicit precondition, rather
than inferring it from the mere absence of a passing score.

A disqualifier is deliberately reserved for a strong signal: multiple independent data points must
simultaneously disagree, not one. A single mismatched field is ordinary negative evidence already
carried by that field's own SCORE outcome; a disqualifier exists only when several fields that would
each need an independent, coincidental data-entry error to explain away all disagree at once, making
innocent explanations implausible. This bar is a subjective design-time judgment about what counts
as strong enough, made explicit in each disqualifying stage's own reasoning rather than left to a
shared formula, since what counts as "strong" differs by evidence type (for example, address
disagreement across all three fields at once, versus first AND last name both falling below a
fuzzy-match threshold at once).

A disqualifier does not remove a candidate — the never-remove invariant still holds — but a RESOLVE
stage may use it to narrow which candidates it is willing to treat as a sole survivor. A RESOLVE
stage that filters this way must do so legibly: reading the specific disqualifiers it relies on (for
example, via `.filter()`/`.reduce()` over a candidate's disqualifier list) rather than relying on an
opaque scoring blend, so a reviewer can see exactly which disqualifying evidence the resolution
depended on.

### These roles are semantic, not a rigid structure

The roles name what a stage does; they are not a mandate that every stage occupy exactly one phase
or that the pipeline be a single clean RECALL-then-NORMALIZE-then-SCORE-then-RESOLVE progression. A
stage may validly straddle roles — for example, a retrieval performed on the database server that
returns already-scored candidates combines RECALL and SCORE in one step. The pipeline is a chain
that may repeat the progression, and a reader must not assume each stage maps to a single role.

### Cost-gated ordering

Cheap, decisive resolutions are sequenced first so that expensive stages run only when no
terminating outcome has yet been reached. In particular, costly retrievals are deferred rather than
run eagerly, and candidates are deliberately not over-fetched to feed later scoring — the expensive
retrieval is itself what is gated, not merely the scoring of its results.

Short-circuiting serves signal quality as well as cost. Once the pipeline has reached a terminating
outcome, continuing to run stages that would be no-ops — or doing extra work to record what a later
stage would have done — would add evaluations that reflect the pipeline's own machinery rather than
the record's identity, polluting the very evidence graph that retrieval and scoring finetuning
depend on. The pipeline records what actually ran under cost-gating, and no more; it does not gather
counterfactual evidence about paths not taken.

### Nested transient pipelines

A stage may run its own scoped, transient pipeline that expands a candidate set, scores it, and
contracts it to only its high-quality survivors, promoting those into the shared pipeline. The
never-remove-a-candidate invariant governs the shared state; reduction is permitted inside a
transient scope, and only vetted survivors cross back into the shared state.

### Discovery tiers and the combined pool

Retrieval is organized into ordered tiers, cheapest and most decisive first. Each tier runs in its
own nested state — an oversized internal pool from a common surname fragment never becomes top-level
state, only its vetted survivors do. Because a tier both retrieves and attempts resolution, it is a
three-argument operation returning a _nested_ state rather than the shared one, which is why it is
not itself a stage and why the top-level flow threads tier boundaries explicitly rather than
reducing a stage list.

Tiers are not uniform in how their outcome is treated, and the difference is load-bearing:

- **The early, high-precision tiers claim their resolution.** When one resolves, that is the answer,
  and the pipeline stops.
- **The later, broader tiers deliberately discard their own nested resolution.** Their candidates
  are pooled with every earlier tier's survivors into one combined set, which is then resolved as a
  whole.

Pooling is what keeps a tier from suppressing a match it did not find: a candidate one tier
retrieves but cannot resolve must not end the record while another tier holds a genuinely
corroborated candidate for it. In the combined pool every candidate from every tier competes on
equal footing under the same resolving stages. Early-tier survivors are carried in as well, rather
than re-retrieved.

The asymmetry is behavioral and validated against retrieval evidence, not a performance detail.
Collapsing the tiers into one uniform sequence that short-circuits on any tier's resolution
reintroduces the suppression.

### Reusable, re-runnable stages

A stage is a reusable function and may run more than once — for example, re-scoring the growing
candidate set each time a retrieval adds candidates. Re-runs are idempotent: adding a candidate that
is already present is a no-op, and re-recording a signal overwrites that signal's own prior entry
rather than accumulating duplicates.

### Evidence completeness

Every signal that contributed to reasoning is recorded on the shared state — including which
retrieval produced a given candidate and the parameters and outputs of similarity computations — so
that an outcome is fully reconstructable after the fact.

### The terminal-outcome guard is implemented once

Checking whether a terminal outcome has already been reached — a match, a skip, or an error — is not
a responsibility any individual stage carries. It is implemented exactly once, in the runner that
reduces an ordered stage list: before invoking each stage, it checks the state's terminal-outcome
slots, and stops immediately without invoking any later stage the moment one is set. A stage is
written, read, and tested purely as a `state -> state` function with no control-flow responsibility
of its own — it is never expected to check whether it should even run. Centralizing the guard this
way is what the uniform stage signature is for: since every stage shares one shape, one generic
runner can iterate the whole list without any stage-specific knowledge, and a stage's own code stays
entirely about the evaluation it performs, never about whether it is reachable. Within a stage list,
order affects only how quickly the pipeline reaches a terminal outcome, never which outcome it can
reach — the guard does not change what a later stage would have concluded, it simply prevents work
the outcome already made moot.

"Implemented once" is a property of the guard's implementation, not a claim that terminal-outcome
slots are read at exactly one call site. Two consequences:

**A stage may compose sub-stages.** A stage that sequences several related stages hands them to the
same runner rather than reimplementing iteration or guarding. It performs no terminal-outcome check
of its own and carries no control-flow responsibility — it delegates unconditionally. Composition
gives a group of stages a name, an ordering, and one place to audit it; it is used both to group
stages sharing a rationale and to build a narrow-then-score-then-resolve sequence from parts. The
runner applies the same guard at both levels, so inlining a composed stage into its parent list
preserves behavior. The grouping is organizational, chosen for legibility.

**Tier boundaries are threaded explicitly, outside any stage list.** The top-level flow is not a
stage list — see "Discovery tiers and the combined pool" below. Each tier boundary inspects the
outcome slots directly, the same explicit-inspection discipline this document prescribes for a call
site reading the error slot. No _stage_ is ever written to wonder whether it should run.

### Order and correctness

Two order properties hold, and they differ by phase. Because no stage removes a candidate from the
shared state, the composition of the candidate set is independent of stage order. The terminal
outcome, however, is claimed by the first stage to reach one, after which later stages take no
action — so the ordering of resolving stages is a behavioral decision that determines which outcome
is reached when more than one resolution is possible. Resolving-stage order must therefore be
validated against evidence, not assumed to be order-independent.

## Status

Accepted

## Consequences

A stage can be tested against the shared state shape alone, without constructing or mocking the rest
of the pipeline, since a stage's inputs and outputs are fully described by that shape. The uniform
`(state) => state` signature makes this a structural guarantee rather than a convention that
individual stages happen to follow: a test constructs one state value, calls the stage, and asserts
on the returned state, with no other stage's shape ever in scope. The narrower per-candidate scorer
signature earns the same benefit one level down — a scorer test constructs a normalized source
record and one candidate, with no pool, no other candidates, and no terminal-outcome slots to set up
at all.

Implementing the terminal-outcome guard in the runner, rather than in each stage, means a stage that
is added, removed, or reordered never needs its own copy of that check updated to match. The
trade-off is that a stage can no longer be exercised in isolation as evidence that it _itself_ would
have no-op'd on an already-terminal state — that guarantee belongs to the runner's own tests, once,
rather than to every stage individually.

Threading tier boundaries outside any stage list carries its own trade-off: adding a discovery tier
means writing that boundary's outcome handling explicitly, and choosing whether the new tier claims
its resolution or pools into the combined set. That choice is behavioral and belongs with the tier,
but it is not one the stage machinery can make on the author's behalf.

Allowing a per-candidate scorer to mutate the one candidate it was handed, rather than requiring it
to return a deep copy, is a pragmatic relaxation of purity, not an oversight — see "A uniform
functional shape" above. The trade-off accepted here is that a candidate's evaluation history is not
itself immutable data: a caller holding a reference to a candidate before it passes through further
scoring will observe that candidate's history grow. This is judged acceptable because a candidate
object has exactly one logical owner at a time in this pipeline's control flow, and its history is
additive, never revised — the risk immutability would guard against (a stale read of data another
part of the system has since changed) does not arise here.

Introducing a new matching signal is an additive change — a new stage — rather than a modification
to existing conditional logic, which was the primary motivation for the decision.

The candidate collection and its accumulated evaluations are retained in full after every terminal
outcome, unconditionally on resolution type — including an automatic MATCH, where the evidence might
otherwise appear disposable once the decision is made. Retention is unconditional because the
evidence graph serves two purposes beyond the immediate outcome: tracing why a specific outcome was
reached, and supplying the labeled record needed to finetune retrieval and scoring. The trade-off is
that memory and reporting surface grow with the number of stages and candidates evaluated, in
exchange for a complete, inspectable record. This retention is what makes evidence completeness
achievable.

Cost-gated ordering lets most records terminate early on cheap, decisive signals, so expensive
retrieval and scoring run only for records still unresolved. The cost of that benefit is that order
is outcome-relevant in the resolving phase: the priority ordering of resolving stages requires
empirical validation, and cannot be reshuffled on the assumption that it only affects performance.

Nested transient pipelines keep costly candidate expansion out of the shared state; because only
vetted survivors are promoted, the shared state stays small and meaningful even when an internal
tier considered a large candidate pool.

The shared vocabulary — RECALL, NORMALIZE, SCORE, MEMOIZATION, RESOLVE, and the four resolution
outcomes — gives a common language for placing and discussing stages. Because a stage may straddle
roles, the language describes intent rather than a structural partition, and must not be read as a
guarantee that each stage performs exactly one role.

The shared state shape and stage machinery (the candidate collection, the terminal-outcome slot, the
terminal-outcome guard, the pipeline runner) are parameterized on the source-record type and
candidate type, rather than hard-coded to trustee matching specifically. Trustee matching is, today,
the only concrete instantiation of this graph — the parameterization exists so a second
legacy-source-to-CAMS matching problem could reuse the same machinery without first proving out the
abstraction against a use case that doesn't yet exist, not as a commitment that one will arrive.
Every concept in this document (RECALL/NORMALIZE/SCORE/MEMOIZATION/RESOLVE, disqualifiers,
processing failure) is described in trustee-matching terms because trustee matching is the only
lived experience this decision is drawn from; a second use case, if one arrives, should be expected
to reveal which of these decisions were trustee-specific and which were genuinely general.
