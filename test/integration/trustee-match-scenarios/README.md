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
| 7   | multiple-match-high-confidence          | name ambiguous between 2 trustees; demographics clearly favor one                                      | Pending verification, `HIGH_CONFIDENCE_MATCH`, winner = the "real" trustee, surrogate `CaseAppointment` keyed by fingerprint (no real appointment yet), `highConfidenceMatchCount++`                |
| 8   | multiple-match-no-winner                | name ambiguous between 2 trustees with **identical** scoring inputs (genuine tie)                      | Pending verification, `MULTIPLE_TRUSTEES_MATCH`, tied candidate scores, `multipleMatchCount++`                                                                                                      |
| 9   | case-not-yet-synced                     | resolves fine, but no `SYNCED_CASE` Cosmos doc exists yet                                              | Event lands in `notYetSyncedEvents` (requeued) — no verification, no appointment                                                                                                                    |
| 10  | case-moved                              | resolves fine, but the seeded `SYNCED_CASE` carries `movedToCaseId`                                    | Skipped silently — no verification, no appointment, no counter incremented                                                                                                                          |
| 11  | re-verification                         | an already-`approved` case is resynced with a would-be-different outcome                               | `reVerificationCount++`; the existing resolved verification is **not** overwritten                                                                                                                  |
| 12  | fingerprint-repeat (Slice 5)            | reformatted repeat of #2's trustee (whitespace/case noise only), no professional id                    | Auto-linked to #2's trustee via the `TRUSTEE_VARIATION` fingerprint bucket — `matchTrusteeByName` is never called, even though #2's trustee shares its name with a decoy trustee seeded for #12/#13 |
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

## Warning: isolated databases only

`clean` (and `run`, which calls `clean` first) resets the `TRUSTEE_APPOINTMENTS_SYNC_STATE` and
`TRUSTEE_PETITION_SYNC_STATE` runtime-state documents — dataflow-wide singleton watermarks (keyed
only by `documentType`, not by case). Only run this harness against an isolated local/test Cosmos
database; running it against a shared environment would reset the sync cursor for every case the
real dataflow is tracking.

## Environments

Two environments via `INTEGRATION_ENV`:

- `local` (default) — localhost containers started by `start-services.sh`
- `azure` — lower-env Azure Government databases (VPN required)

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

## Commands

| Command       | Description                                                       |
| ------------- | ----------------------------------------------------------------- |
| `check-env`   | Verify required environment variables are set                     |
| `seed-schema` | (local only) Create `DXTR_INT` database + apply `AO_*` DDL        |
| `seed-sql`    | Drop/recreate DXTR fixture rows for 13 scenarios (idempotent)     |
| `seed-cosmos` | Seed synced cases, trustees, appointments, professional ids       |
| `run`         | Full test: clean → seed → read DXTR → match/process (x4) → assert |
| `clean`       | Remove seeded rows/documents from both databases                  |
| `help`        | Show usage                                                        |

## Fixture data

See `seed/01-seed-dxtr-data.sql` for the exact DXTR rows and
`scripts/trustee-match-scenarios-harness.ts` for the matching Cosmos fixtures.
