# Backfill Trustee Professional IDs — ACMS↔CAMS Matching — Integration Test

Exercises the **new** ACMS gateway methods introduced by the CAMS-816 / `CAMS-2-bko` epic
(`backend/lib/adapters/gateways/acms/acms.gateway.ts`) together with the real matching/scoring logic
(`backend/lib/use-cases/dataflows/backfill-trustee-professional-ids.ts` and
`acms-trustee-match.helpers.ts`) against a real SQL Edge instance (mimicking ACMS) and a real
MongoDB instance (mimicking Cosmos) — no mocked gateways or repositories anywhere in the path.

Real integration-test harnesses for database-touching code exist because mocks can pass while the
real query is subtly wrong ("mocks lie"). This applies to the **new** code this epic introduces --
the widened `getAllTrusteeProfessionalRecords`, the new batched
`getCmmapAppointmentsForProfessionalIds`, and the new `getDivisionToCourtMap` (live `CMMDO` join).

## Explicitly out of scope

- **`test/integration/migrate-trustees/`'s heal-path harness section** — that section exercises the
  OLD exact-match backfill code (`processAcmsRecord`/`backfillProfessionalIdsPage` and friends),
  which a separate, later task deletes from production code. Per explicit Moderator direction, that
  harness section is left untouched as accepted tech debt. This harness does not modify, reference,
  or duplicate anything under `test/integration/migrate-trustees/`.
- **The Azure Functions dataflow handler** —
  `backend/function-apps/dataflows/migrations/backfill-trustee-professional-ids.ts` does not exist
  yet as of when this harness was authored (only the use-case layer, CAMS-2-bko.7, had landed). This
  harness therefore calls `processAcmsProfessionalRecordsPage` and `readAllAcmsProfessionalRecords`
  directly rather than going through a queue-triggered handler — see "Scope: gateway + use-case
  layer only" below. **Follow-up**: once the handler lands, add handler-level coverage (START/PAGE
  queue wiring, `StartMessage.flushQueues`, `ensureContainersExist`) to this same directory,
  following the migration pattern's standard Azurite-based event-synthesis approach documented in
  the `cams-dataflow` skill's `dataflow-integration-testing.md`.

## Scope: gateway + use-case layer only

This harness does **not** start the dataflows function app or use Azurite. It calls the real gateway
(`AcmsGatewayImpl`, via `factory.getAcmsGateway`) and the real use-case functions
(`readAllAcmsProfessionalRecords`, `processAcmsProfessionalRecordsPage`) directly against real SQL
Edge + MongoDB — exactly the layer this issue (`CAMS-2-bko.8`) is scoped to. No queue triggers, no
`StartMessage`, no `ensureContainersExist` — those only apply once a handler exists to wire up.

## Containers

| Container | Image                                     | Role                                                                                         |
| --------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| MongoDB   | `mongo:7.0`                               | Cosmos stand-in — `trustees`, `trustee-appointments`, `trustee-professional-ids` collections |
| SQL Edge  | `mcr.microsoft.com/azure-sql-edge:latest` | ACMS stand-in — `CMMPR`, `CMMAP`, `CMMDB`, `CMMDO` tables                                    |

Azurite is **not** used — see "Scope" above.

## Prerequisites

- Podman installed and running.
- Node.js (matching `.nvmrc`) with the repo's hoisted dependencies (`npm ci` from repo root).
- `common` built (`npm run build:common` from repo root) — the harness imports backend code that
  depends on `common`'s compiled output.

Copy the env template and fill in a password:

```bash
cp scripts/.env.template scripts/.env
# set MSSQL_PASS in scripts/.env
```

Then create `.env.local` in this directory (`backfill-trustee-professional-ids/.env.local`,
gitignored — no template is committed for it, since the project's `.gitignore` only exempts
`.env.template`) with:

```bash
MONGO_CONNECTION_STRING=mongodb://localhost:27017/cams-integration?retrywrites=false
COSMOS_DATABASE_NAME=cams-integration
ACMS_MSSQL_HOST=localhost
ACMS_MSSQL_PORT=1433
ACMS_MSSQL_DATABASE=ACMS_INT
ACMS_MSSQL_USER=sa
ACMS_MSSQL_PASS=<same value as scripts/.env>
ACMS_MSSQL_ENCRYPT=true
ACMS_MSSQL_TRUST_UNSIGNED_CERT=true
```

This harness reuses the same container ports (Mongo `27017`, SQL Edge `1433`) as the other
`test/integration/` harnesses — stop any other harness's containers before starting this one's; they
are not meant to run concurrently.

## Quick start

```bash
cd backfill-trustee-professional-ids/scripts
./start-services.sh

cd ../..   # back to test/integration/
npm run backfill-trustee-professional-ids -- seed-schema
npm run backfill-trustee-professional-ids -- seed-sql
npm run backfill-trustee-professional-ids -- seed-cosmos
npm run backfill-trustee-professional-ids -- run
npm run backfill-trustee-professional-ids -- clean

cd backfill-trustee-professional-ids/scripts
./stop-services.sh
```

## Commands

| Command       | Description                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `check-env`   | Verify required environment variables are set                                                                           |
| `seed-schema` | Create `ACMS_INT` database + apply `CMMPR`/`CMMAP`/`CMMDB`/`CMMDO` DDL (`database/schema/00-schema.sql`)                |
| `seed-sql`    | Drop/recreate the 6 ACMS fixture records across 5 scenarios (idempotent) — `fixtures/01-seed-acms-scenarios.sql`        |
| `seed-cosmos` | Seed CAMS trustees, trustee-appointments, and the scenario-5 pre-existing mapping                                       |
| `run`         | Full test: clean → seed → `getDivisionToCourtMap` → `processAcmsProfessionalRecordsPage` (x2, for idempotency) → assert |
| `clean`       | Remove test rows/documents from both databases                                                                          |
| `help`        | Show usage                                                                                                              |

## Schema

`database/schema/00-schema.sql` defines `CMMPR`, `CMMAP`, `CMMDB`, and `CMMDO` — a hand-crafted
subset of the real ACMS schema covering only the columns the three gateway methods under test
actually select or join on. Provenance, per column source:

- **`CMMPR`** — union of the two existing local `CMMPR` DDL variants already in this repo
  (`test/integration/migrate-trustees/seed/05-seed-heal-cmmpr.sql`, which has
  `GROUP_DESIGNATOR`/`UST_PROF_CODE`/`PROF_TYPE`;
  `test/integration/acms-cams-transition/seed/ 01-seed-acms-replica.sql`, which has
  `PROF_MI`/`PROF_ADDRESS1`/`PROF_ADDRESS2`/`PROF_CITY`/ `PROF_ZIP`) plus
  `PROF_COMMERCIAL_PHONE_NBR`, which no existing local fixture set covers — needed by the widened
  `getAllTrusteeProfessionalRecords` query.
- **`CMMAP`/`CMMDB`** — reused verbatim from
  `test/integration/migrate-case-appointments/seed/00-seed-cmmap-schema.sql`, which already covers
  everything `getCmmapAppointmentsForProfessionalIds` needs (`CASE_DIV`/`CASE_YEAR`/`CASE_NUMBER`,
  `GROUP_DESIGNATOR`/`PROF_CODE`, `DELETE_CODE`, `APPT_TYPE` on `CMMAP`; `CURR_CASE_CHAPT`/
  `DELETE_CODE` on `CMMDB`). **`CMMKE` is deliberately NOT created** —
  `getCmmapAppointmentsForProfessionalIds` does not join it, unlike the existing
  `getCmmapAppointments`/`getCmmapAppointmentsRaw` methods it was adapted from.
- **`CMMDO`** — entirely **new**; no existing fixture set in this repo covers it. Authored from
  scratch from the columns `getDivisionToCourtMap` actually selects (`CASE_DIV`, `COURT_ID`,
  `DELETE_CODE`).

## Fixtures and coverage

`fixtures/01-seed-acms-scenarios.sql` seeds the ACMS-side (SQL) half of all 6 ACMS records across 5
scenarios; the harness script's `seedCosmos()` seeds the matching CAMS-side (Mongo) half. Reserved
namespace: `GROUP_DESIGNATOR = 'BT'`, `UST_PROF_CODE`/`PROF_CODE` block `97001`-`97006`, `CASE_DIV`
blocks `601`-`604` and `701`-`711`, `trusteeId` prefix `bkotp-*`.

| #   | Scenario                                                                            | ACMS id    | Setup                                                                                                                                                                                                                                                                                                       | Expected outcome                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1a  | **Phonetic-search match, full corroboration**                                       | `BT-97001` | Full name/address/phone/appointment corroboration against `bkotp-s1-correct`, found via `searchTrusteesByNameScored`                                                                                                                                                                                        | Score 100 → **matched**                                                                                                                                                                                                                                                                         |
| 1b  | **Phonetic-search match, full corroboration**                                       | `BT-97002` | A second, independent data point exercising the same code path against `bkotp-s2-correct` — incidentally has a real (current) state differing from its ACMS record's, which is irrelevant since state plays no role in candidate selection or scoring                                                       | Score 100 → **matched**                                                                                                                                                                                                                                                                         |
| 2   | **Multi-candidate gap-check**                                                       | `BT-97003` | Two CAMS trustees (`bkotp-s3-winner`, `bkotp-s3-runnerup`) share the identical name/state/address/phone. Winner's district set matches ACMS's 10-court set exactly (district=100); runner-up's district set shares 9 of those 10 courts plus one different court (district=90, via the overlap coefficient) | Winner scores 100, runner-up scores ~96.84 — both individually clear the 90 auto-match threshold, but the gap between them (~3.16) is `< ACMS_FUZZY_MATCH_MIN_GAP` (5) → **neither is matched** (the accept-rule shape fix in action)                                                           |
| 3   | **Lone candidate below threshold**                                                  | `BT-97004` | `bkotp-s4-weak` is found via phonetic search but has a mismatched address, no phone on file, and zero appointment history on either side (district/chapter both `null`, not `0`)                                                                                                                            | Total score ≈ 83.3 `< 90` → **permanently unmatched**; asserted by confirming absence of any `trustee-professional-ids` document for `BT-97004` — no JSONL, no review file, just absence                                                                                                        |
| 4   | **Closed/pre-2018 appointments still match** (_the most important regression case_) | `BT-97005` | Both of this professional's `CMMAP` rows are closed cases with `CLOSED_BY_COURT_DATE`/`CLOSED_BY_UST_DATE` in 2015/2016 (pre-2018). The matching CAMS trustee (`bkotp-s5-active`) is otherwise a full corroboration match                                                                                   | `getCmmapAppointmentsForProfessionalIds` has no open-case filter, so these closed/pre-2018 rows still populate the ACMS-side district/chapter sets in full → score 100 → **matched**. This proves the open-case filter was genuinely dropped from the query's _behavior_, not just its SQL text |
| 5   | **Already-mapped idempotency**                                                      | `BT-97006` | A `trustee-professional-ids` mapping (`bkotp-s6-existing` ↔ `BT-97006`) is pre-seeded by the harness before `processAcmsProfessionalRecordsPage` runs                                                                                                                                                       | The record is skipped via `findByAcmsProfessionalIds` and counted as `alreadyMapped` — never scored, never re-written. Re-running the full page a second time leaves exactly one mapping document, `matched` for this id stays `0`, `alreadyMapped` for it stays `1` — a safe no-op             |

`run` also re-runs `processAcmsProfessionalRecordsPage` a second time over the same record set after
the first pass completes (Stage 5), independent of scenario 5's own pre-seeded mapping, to confirm
scenarios 1a/1b/4's newly-created mappings are themselves idempotent on a second pass
(`alreadyMapped` picks them up, `matched` does not double-count them, and each still has exactly one
mapping document).

## Assertion summary

Beyond the scenario outcomes in the table above, `run` also asserts:

- `getAllTrusteeProfessionalRecords`'s widened columns (`city`, `state`, `zip`, `phone`) round-trip
  correctly for at least one fixture record, with the numeric ACMS `zip`/`phone` columns normalized
  to the expected zero-padded strings.
- `getDivisionToCourtMap`'s live `CMMDO` join returns the correct `CASE_DIV -> COURT_ID` entry for
  every `CASE_DIV` this harness seeds.
- Aggregate page counts (`matched`/`unmatched`/`alreadyMapped`) match expectations exactly on both
  the first and second pass.

## Cleanup

```bash
npm run backfill-trustee-professional-ids -- clean
cd scripts && ./stop-services.sh
```

`clean` is idempotent and safe to run multiple times; it only removes rows/documents under this
harness's reserved namespace (see "Fixtures and coverage" above), so it never touches other
harnesses' data even if their containers happen to be running against the same database name.
