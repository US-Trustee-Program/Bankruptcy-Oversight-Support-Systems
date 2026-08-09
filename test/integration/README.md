# Integration Tests

Manually-run harnesses that exercise real backend code against real infrastructure (MongoDB/Cosmos
DB, SQL Server) — no mocks. These are dev tooling for validating behavior and synthesizing better
test data in lower environments that are otherwise data-poor; they are **not** run in CI. Each
subdirectory is its own harness with its own README describing what it covers.

**Note for future agents/contributors:** because these fixtures and hand-rolled schema assumptions
(index specs, collection shapes, seeded document shapes) are maintained independently of the real
production schema in `ops/cloud-deployment/`, they can silently drift out of sync as the actual
database schema evolves. When you change a Cosmos collection's fields, indexes, or shard key in
`ops/cloud-deployment/lib/cosmos/mongo/cosmos-collections.bicep`, take a moment to check whether any
harness under `test/integration/` seeds or asserts against that same collection, and update its
fixtures/index specs to match. A harness that still passes against a stale schema assumption is
worse than no harness at all — it gives false confidence.

## `_lib/`

Shared code sourced/imported by individual harnesses. Not a harness itself.

### `ephemeral-cosmos-database.ts`

Provisions and tears down a throwaway Cosmos DB Mongo API database for a harness that wants to
validate behavior against real Cosmos (as an alternative to a local Podman MongoDB instance).

**Why this exists via the Mongo driver instead of Azure `az` CLI / Bicep:** developers are never
granted `az` RBAC on the shared Cosmos account — only a CI job with a federated OIDC identity could
call `az cosmosdb`/`az deployment group create` successfully. Since none of these harnesses are
wired into CI (and shouldn't be — they're manual dev tooling, not a CI gate), an `az`-CLI-based
approach would only ever work for nobody. This module instead connects with the Mongo driver
directly using `MONGO_CONNECTION_STRING` — the same connection-string credential every developer
already has via their local `.env` (mirroring `backend/.env`'s convention) — and creates/drops a
database that way.

**Accepted trade-off:** this only creates the specific collection/index a harness asks for, not the
full production schema (all collections, shard keys, indexes) that
`ops/cloud-deployment/ustp-cams-cosmos-e2e.bicep` would deploy. A future change to the real
Bicep-declared indexes won't automatically show up here. That's fine for this module's purpose —
these harnesses exist to synthesize realistic dev/test data and validate specific behaviors, not to
be a production-fidelity regression gate — but it does mean don't treat a pass here as proof the
real deployed schema is correct; that's what the collection's own index policy in
`cosmos-collections.bicep` is the source of truth for.

**Requires** `MONGO_CONNECTION_STRING` in the environment (e.g. sourced from a local, gitignored
`.env` — see `backend/.env` for the convention). Ephemeral database names must contain `-idxtest-`;
both `standUpEphemeralCosmosDatabase` and `tearDownEphemeralCosmosDatabase` refuse to operate on any
name that doesn't, so a variable mix-up can never touch a persistent database.

Usage — see the file's own header comment for exact CLI flags and the two exported functions
(`standUpEphemeralCosmosDatabase`, `tearDownEphemeralCosmosDatabase`) for programmatic use from
another harness's `.ts` script.
