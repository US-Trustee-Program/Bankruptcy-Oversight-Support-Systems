# Trustee Match Scenarios — Matching Algorithm Correctness — Integration Test

Exercises `SyncTrusteeCaseAppointmentsUseCase`
(`backend/lib/use-cases/dataflows/sync-trustee-case-appointments.ts`) against a real DXTR SQL Server
instance (mimicked locally with SQL Edge), covering every distinct outcome branch of the trustee
matching algorithm (`backend/lib/use-cases/dataflows/trustee-match.helpers.ts` +
`processAppointments`'s decision tree) with thirteen fixture cases.

## Scope

Scenarios 1-11 test the **existing (pre-Slice-5) matching algorithm** — CAMS-809's Slices 1-4
scoring/matching pipeline. Scenarios 12-13 test the **CAMS-809 Slice 5 fingerprint/variant
memoization mechanism** (`trustee-variant.helpers.ts`, `TRUSTEE_VARIATION`) layered on top of that
same algorithm: a fingerprint hit resolves `trusteeId` directly (bypassing `matchTrusteeByName`
entirely), and a miss falls through to the untouched algorithm from scenarios 1-11.

## What it tests

| #   | Scenario                                | Trigger                                                                                                | Expected outcome                                                                                                                                                                                    |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | reserved-id-skip                        | `acmsProfessionalId` is a reserved value (`XX-99999`)                                                  | Skipped entirely — no verification, no appointment, `reservedIdSkippedCount++`                                                                                                                      |
| 2   | perfect-match-professional-id           | professional-id fast path resolves uniquely + active appointment in exact court/division/chapter       | Auto-linked, no `trustee-match-verification` doc written (never reviewed by a human, so nothing belongs in the review queue), `autoMatchCount++`                                                    |
| 3   | perfect-match-by-name                   | no professional id; unique CAMS trustee name match + active appointment                                | Auto-linked (same as #2, via `matchTrusteeByName`)                                                                                                                                                  |
| 4   | perfect-match-inactive-status           | resolves uniquely, but the only matching-court/division/chapter appointment is `voluntarily-suspended` | Pending verification, `PERFECT_MATCH_INACTIVE_STATUS`, `perfectMatchInactiveCount++`                                                                                                                |
| 5   | imperfect-match                         | resolves uniquely, trustee has **zero** appointments at all                                            | Pending verification, `IMPERFECT_MATCH`, `nameScore=100`/`address`,`district`,`chapter`=`0`, `imperfectMatchCount++`                                                                                |
| 6   | no-match                                | name matches no seeded CAMS trustee                                                                    | Pending verification, `NO_TRUSTEE_MATCH`, no candidates, `noMatchCount++`                                                                                                                           |
| 7   | multiple-match-high-confidence          | name ambiguous between 2 trustees; demographics clearly favor one                                      | Pending verification, `AMBIGUOUS_MATCH_RESOLVED`, winner = the "real" trustee, surrogate `CaseAppointment` keyed by fingerprint (no real appointment yet), `highConfidenceMatchCount++`             |
| 8   | multiple-match-no-winner                | name ambiguous between 2 trustees with **identical** scoring inputs (genuine tie)                      | Pending verification, `AMBIGUOUS_MATCH_UNRESOLVED`, tied candidate scores, `multipleMatchCount++`                                                                                                   |
| 9   | case-not-yet-synced                     | resolves fine, but no `SYNCED_CASE` Cosmos doc exists yet                                              | Event lands in `notYetSyncedEvents` (requeued) — no verification, no appointment                                                                                                                    |
| 10  | case-moved                              | resolves fine, but the seeded `SYNCED_CASE` carries `movedToCaseId`                                    | Skipped silently — no verification, no appointment, no counter incremented                                                                                                                          |
| 11  | re-verification                         | an already-`approved` case is resynced with a would-be-different outcome                               | `reVerificationCount++`; the existing resolved verification is **not** overwritten                                                                                                                  |
| 12  | fingerprint-repeat (Slice 5)            | byte-identical repeat of #2's trustee, no professional id                                              | Auto-linked to #2's trustee via the `TRUSTEE_VARIATION` fingerprint bucket — `matchTrusteeByName` is never called, even though #2's trustee shares its name with a decoy trustee seeded for #12/#13 |
| 13  | fingerprint-no-false-collapse (Slice 5) | same ambiguous name as #2/#12, but genuinely different address/phone/email (matches the decoy)         | Fingerprint bucket misses (different variant); falls through to fuzzy matching, which resolves confidently to the decoy — **not** #2's trustee                                                      |

Scenario 11 runs in two extra `processAppointments` calls after the main first pass: first resolving
as `imperfect-match` (zero appointments, like #5), then a simulated human approval is written
directly to Mongo, then the same event is reprocessed to prove `upsertMatchVerification`'s "already
resolved, don't rewrite" guard.

Scenarios 12-13 run together in their own `processAppointments` call, deliberately AFTER the main
first pass completes (rather than in the same batch) — the DXTR query orders events by
`TX_DATE DESC`, so within a single batch scenario 2 (the "origin" whose resolution writes the
`TRUSTEE_VARIATION` scenario 12 needs) could process after scenario 12/13 depending on date
ordering. Running them in a separate, later call sidesteps that ordering question entirely.

## Stage 5/6 — proofs only real Cosmos can provide

Beyond the 13 DXTR-driven scenarios, `run` also executes two further stages against fixtures seeded
directly into Cosmos (no DXTR row involved):

- **Stage 5 (sort/index)** — `getActiveByCaseId`
  (`backend/lib/adapters/gateways/mongo/trustee-case-appointments.mongo.repository.ts`) sorts by
  `assignedOn` ASCENDING and relies on the `{caseId:1, assignedOn:1}` compound index declared in
  `cosmos-collections.bicep` for `case-trustee-appointments`. This stage seeds two active
  appointments on one case with different `assignedOn` values and asserts the real repository
  returns the OLDEST one. In `azure` mode it also asserts the index itself exists on the collection,
  mirroring `trustee-match-verification-search/scripts/run-tests.ts`'s Test 1 — this is the class of
  bug (Cosmos index-policy enforcement) a fully-mocked unit test cannot catch.
- **Stage 6 (stable-`assignedOn` idempotency)** — `applyResolvedTrustee`/
  `writeSurrogateAppointment` derive `assignedOn` from `event.appointedDate` (not wall-clock time)
  so `upsert`'s natural key (`documentType + caseId + trusteeId + assignedOn`) stays stable across
  repeated processing of the same event. This stage reprocesses one identical fixture event twice
  through the real `SyncTrusteeCaseAppointmentsUseCase.processAppointments()` and asserts exactly
  one `case-trustee-appointments` document exists afterward — proof against a real `replaceOne`
  upsert, which a mocked repository's recorded call args cannot provide.

Explicitly out of scope: fault-injecting real Cosmos throttling to test the transient
soft-close-failure path (`TooManyRequestsError`/`GatewayTimeoutError` aborting before create). That
path is already covered by `sync-trustee-case-appointments.test.ts`'s mocked `test.each` and isn't
practical to force against real Cosmos — this harness's job is proving what only real Cosmos can
prove (index enforcement, true upsert semantics), not re-proving what mocks already cover well.

## Warning: isolated databases only

`clean` (and `run`, which calls `clean` first) resets the `TRUSTEE_APPOINTMENTS_SYNC_STATE` and
`TRUSTEE_PETITION_SYNC_STATE` runtime-state documents — dataflow-wide singleton watermarks (keyed
only by `documentType`, not by case). Only run this harness against an isolated local/test Cosmos
database; running it against a shared environment would reset the sync cursor for every case the
real dataflow is tracking.

## Environments

Two environments via `INTEGRATION_ENV`:

- `local` (default) — localhost containers started by `start-services.sh`. Plain MongoDB has no
  concept of Cosmos's index-policy enforcement, so this mode validates Stage 5's query LOGIC only —
  it cannot catch the indexing-policy bug that stage exists to guard.
- `azure` — DXTR still comes from lower-env Azure Government SQL Server (VPN required), but the
  Cosmos side is a real, EPHEMERAL Cosmos DB Mongo API database — a new database name within the
  same Cosmos account `backend/.env`'s `MONGO_CONNECTION_STRING` already points to — stood up fresh
  by `run` via `../../_lib/ephemeral-cosmos-database.ts` before seeding and torn down the same way
  afterward (success or failure). Never the shared/persistent database `backend/.env`'s
  `COSMOS_DATABASE_NAME` otherwise names. Only this mode can catch the Stage 5 indexing bug, because
  only the real Cosmos RU engine enforces index-policy restrictions. See
  `test/integration/README.md` (`_lib` section) for why this uses the Mongo driver rather than the
  Azure `az` CLI.

This harness reuses the same container ports (Mongo `27017`, SQL Edge `1433`) as the other
`test/integration/` harnesses — stop any other harness's containers before starting this one's; they
are not meant to run concurrently.

## Local workflow

```bash
cd trustee-match-scenarios/scripts
./start-services.sh

cd ../..   # back to test/integration/
npm run trustee-match-scenarios -- seed-schema
npm run trustee-match-scenarios -- seed-sql
npm run trustee-match-scenarios -- seed-cosmos
npm run trustee-match-scenarios -- run
npm run trustee-match-scenarios -- clean

cd trustee-match-scenarios/scripts
./stop-services.sh
```

Before the first run, copy the env template and fill in a password:

```bash
cp scripts/.env.template scripts/.env
# set MSSQL_PASS in scripts/.env
```

Then create `.env.local` in this directory (`trustee-match-scenarios/.env.local`, gitignored — no
template is committed, since the project's `.gitignore` only exempts `.env.template`) with:

```bash
MONGO_CONNECTION_STRING=mongodb://localhost:27017/cams-integration?retrywrites=false
COSMOS_DATABASE_NAME=cams-integration
MSSQL_HOST=localhost
MSSQL_PORT=1433
MSSQL_DATABASE_DXTR=DXTR_INT
MSSQL_USER=sa
MSSQL_PASS=<same value as scripts/.env>
MSSQL_ENCRYPT=true
MSSQL_TRUST_UNSIGNED_CERT=true
```

## Azure workflow (manual only — not wired into CI)

Requires `MONGO_CONNECTION_STRING` in the environment (e.g. sourced from `backend/.env`) and VPN
access to the lower-env DXTR SQL Server. `run` provisions and tears down its own ephemeral Cosmos
database — no `COSMOS_DATABASE_NAME` setup needed beforehand:

```bash
INTEGRATION_ENV=azure npm run trustee-match-scenarios -- run
```

## Commands

| Command       | Description                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-env`   | Verify required environment variables are set                                                                                                     |
| `seed-schema` | (local only) Create `DXTR_INT` database + apply `AO_*` DDL                                                                                        |
| `seed-sql`    | Drop/recreate DXTR fixture rows for 13 scenarios (idempotent)                                                                                     |
| `seed-cosmos` | Seed synced cases, trustees, appointments, professional ids                                                                                       |
| `run`         | Full test: (azure: provision ephemeral DB) → clean → seed → read DXTR → match/process (x4) → Stage 5/6 → assert → (azure: tear down ephemeral DB) |
| `clean`       | Remove seeded rows/documents from both databases                                                                                                  |
| `help`        | Show usage                                                                                                                                        |

## Fixture data

See `seed/01-seed-dxtr-data.sql` for the exact DXTR rows and
`scripts/trustee-match-scenarios-harness.ts` for the matching Cosmos fixtures.
