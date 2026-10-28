# Trustee Match Scenarios — Matching Algorithm Correctness — Integration Test

Exercises `SyncTrusteeCaseAppointmentsUseCase`
(`backend/lib/use-cases/dataflows/sync-trustee-case-appointments.ts`) against a real DXTR SQL Server
instance (mimicked locally with SQL Edge), covering every distinct outcome of the trustee-match
pipeline (`backend/lib/use-cases/dataflows/trustee-match-pipeline-stages.ts`) as the DXTR sync
applies it, with twelve fixture cases (numbered 2-13; #1 `reserved-id-skip` was removed once ACMS
professional ID matching was retired).

## Scope

The pipeline decides (CAMS-953 Slice 2): a **resolved** match writes the case appointment and
records in `checks.matchedTrusteeAppointment` whether one of the trustee's appointments covers the
case; an **unresolved** match writes a pending identity task (`trustee-match-verification`) with
`source: 'DXTR'`, `mismatchReason` `'ambiguous'` (2+ candidates) or `'no match'` (0 or 1), and the
pipeline's serialized state as `findings` - never `matchCandidates`. Scenarios 12-13 test the
**fingerprint/variant memoization** (`trustee-variant.helpers.ts`, `TRUSTEE_VARIATION`) layered on
top: a fingerprint hit resolves `trusteeId` directly, a miss falls through to the pipeline.

## What it tests

| #   | Scenario                                         | Trigger                                                                                                | Expected outcome                                                                                                  |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 2   | perfect-match-ambiguous-name-resolved-by-scoring | name ambiguous between two seeded trustees; demographics favor one                                     | Appointment written to the winner, `matchedTrusteeAppointment: true`, no identity task, `autoMatchCount++`        |
| 3   | perfect-match-by-name                            | unique CAMS trustee name match + active appointment                                                    | Same as #2                                                                                                        |
| 4   | perfect-match-inactive-status                    | resolves uniquely, but the only matching-court/division/chapter appointment is `voluntarily-suspended` | Appointment written, `matchedTrusteeAppointment: false` (an appointment concern, not an identity task), no task   |
| 5   | imperfect-match                                  | resolves uniquely, trustee has **zero** appointments at all                                            | Same as #4                                                                                                        |
| 6   | no-match                                         | name matches no seeded CAMS trustee                                                                    | Pending `'no match'` identity task, no findings candidates, `noMatchCount++`                                      |
| 7   | multiple-match-high-confidence                   | name ambiguous between 2 trustees; demographics clearly favor one                                      | Same as #2, linked to the "real" trustee                                                                          |
| 8   | multiple-match-no-winner                         | name ambiguous between 2 trustees with nothing that separates them                                     | Pending `'ambiguous'` identity task with both trustees as findings candidates, `multipleMatchCount++`             |
| 9   | case-not-yet-synced                              | resolves fine, but no `SYNCED_CASE` Cosmos doc exists yet                                              | Event lands in `notYetSyncedEvents` (requeued) — no task, no appointment                                          |
| 10  | case-moved                                       | resolves fine, but the seeded `SYNCED_CASE` carries `movedToCaseId`                                    | Skipped silently — no task, no appointment, no counter incremented                                                |
| 11  | re-verification                                  | an already-`approved` task is resynced                                                                 | `reVerificationCount++`; the approved task is **not** overwritten                                                 |
| 12  | fingerprint-repeat (Slice 5)                     | byte-identical repeat of #2's trustee                                                                  | Auto-linked to #2's trustee via the `TRUSTEE_VARIATION` fingerprint bucket, without matching                      |
| 13  | fingerprint-no-false-collapse (Slice 5)          | same ambiguous name as #2/#12, but genuinely different address/phone/email (matches the decoy)         | Fingerprint bucket misses; the pipeline resolves to the decoy — **not** #2's trustee — and auto-links, same as #7 |

Scenario 11 runs in two extra `processAppointments` calls after the main first pass. Its seeded CAMS
trustee is deliberately named differently from the DXTR party, so the first call writes a pending
`'no match'` identity task; a simulated human approval is then written directly to Mongo, and the
same event is reprocessed to prove the merge-upsert's "never change a non-pending task" guard.

Scenarios 12-13 run together in their own `processAppointments` call, deliberately AFTER the main
first pass completes (rather than in the same batch) — the DXTR query orders events by
`TX_DATE DESC`, so within a single batch scenario 2 (the "origin" whose resolution writes the
`TRUSTEE_VARIATION` scenario 12 needs) could process after scenario 12/13 depending on date
ordering. Running them in a separate, later call sidesteps that ordering question entirely.

## Stage 5/6 — proofs only real Cosmos can provide

Beyond the 12 DXTR-driven scenarios, `run` also executes two further stages against fixtures seeded
directly into Cosmos (no DXTR row involved):

- **Stage 5 (sort/index)** — `getActiveByCaseId`
  (`backend/lib/adapters/gateways/mongo/trustee-case-appointments.mongo.repository.ts`) sorts by
  `assignedOn` DESCENDING and relies on the `{caseId:1, assignedOn:1}` compound index declared in
  `cosmos-collections.bicep` for `case-trustee-appointments`. This stage seeds two active
  appointments on one case with different `assignedOn` values and asserts the real repository
  returns the NEWEST one. In `azure` mode it also asserts the index itself exists on the collection,
  mirroring `trustee-match-verification-search/scripts/run-tests.ts`'s Test 1 — this is the class of
  bug (Cosmos index-policy enforcement) a fully-mocked unit test cannot catch.
- **Stage 6 (stable-`assignedOn` idempotency)** — `applyResolvedTrustee`/
  `writeSurrogateAppointment` derive `assignedOn` from `event.appointedDate` (not wall-clock time)
  so `upsert`'s natural key (`documentType + caseId + trusteeId + assignedOn`) stays stable across
  repeated processing of the same event. This stage reprocesses one identical fixture event twice
  through the real `SyncTrusteeCaseAppointmentsUseCase.processAppointments()` and asserts exactly
  one `case-trustee-appointments` document exists afterward — proof against a real `replaceOne`
  upsert, which a mocked repository's recorded call args cannot provide.

- **Stage 8 (bad REC date falls back to TX_DATE)** — `CasesDxtrGateway.getTrusteeAppointments`
  (`cases.dxtr.gateway.ts`) falls back to `TX.TX_DATE` when REC's fixed-width embedded appointment
  date is blank/unparseable. Seeds one `AO_TX` row (CS_CASEID `999999413`, case `083-26-88913`) with
  a blank REC date and asserts the real DXTR query still returns the correct `appointedDate`,
  sourced from `TX_DATE` via `CONVERT(VARCHAR(10), TX.TX_DATE, 120)` — proof this SQL actually
  compiles and returns the expected value against a real SQL Server table, which a mocked-gateway
  unit test cannot provide. This exact stage caught an earlier version of the fix that used
  `FORMAT(TX.TX_DATE, 'yyyy-MM-dd')` instead, which fails against SQL Edge (and many SQL Server
  instances) with "Common Language Runtime(CLR) is not enabled on this instance." — `FORMAT` depends
  on the CLR; `CONVERT` does not. Unlike Stages 5-7, this DOES round-trip through DXTR (via
  `casesGateway.getTrusteeAppointments` directly, not `processAppointments`) but is otherwise
  standalone: excluded from the 12-scenario matching pipeline, no Cosmos writes.

- **Stage 9 (sentinel professional code skip rule)** — `sync-trustee-case-appointments.ts` skips a
  DXTR trustee-appointment event when its embedded professional code (`AO_TX.REC` offset 17-21 for
  `TX_TYPE='A'`/`TX_CODE='TR'`, parsed via `TX_TYPE_A_PROF_CODE_OFFSET`) is a sentinel value
  (`"00000"` = no trustee appointed, `"99999"` = professional ID unavailable) AND the record has no
  usable contact info at all (address/phone/email) — either because the name is blank too, or
  because the name matches a bogus/administrative keyword (`isBogusTrusteeName`). A bogus-looking
  name never overrides real contact info: a sentinel-coded record with a real address/phone/email
  always reaches matching regardless of what its name looks like. Seeds four `AO_TX` rows (CS_CASEID
  `999999414`-`999999417`, cases `083-26-88914`-`88917`) covering: sentinel + no name/address
  (skip), sentinel + bogus name WITH populated contact fields (NOT skipped — reaches matching,
  writes a `'no match'` identity task), sentinel + genuine synthetic name/address (NOT skipped —
  reaches matching, writes a `'no match'` identity task), and a non-sentinel code with no
  demographics (skipped only by the pre-existing empty-demographics rule). Like Stage 8, round-trips
  through DXTR directly (proving the real `SUBSTRING(TX.REC, 17, 5)` extraction) and additionally
  through `processAppointments()` for the skip/no-skip decision — proof against real query results
  and real `resolveSkipReason`/`isSentinelWithNoIdentity` orchestration, which a mocked-gateway unit
  test cannot provide. Seeds two Cosmos `SYNCED_CASE` fixtures (one for each of the two cases that
  reach matching) directly in the stage itself rather than joining the shared 12-scenario fixture
  set.

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
| `seed-sql`    | Drop/recreate DXTR fixture rows: 12 scenarios + Stage 8 bad-REC-date case + Stage 9 sentinel-profCode cases (idempotent)                          |
| `seed-cosmos` | Seed synced cases, trustees, appointments                                                                                                         |
| `run`         | Full test: (azure: provision ephemeral DB) → clean → seed → read DXTR → match/process (x4) → Stage 5/6 → assert → (azure: tear down ephemeral DB) |
| `clean`       | Remove seeded rows/documents from both databases                                                                                                  |
| `help`        | Show usage                                                                                                                                        |

## Fixture data

See `seed/01-seed-dxtr-data.sql` for the exact DXTR rows and
`scripts/trustee-match-scenarios-harness.ts` for the matching Cosmos fixtures.
