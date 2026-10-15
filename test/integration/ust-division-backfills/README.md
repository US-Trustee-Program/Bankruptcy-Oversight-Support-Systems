# ust-division-backfills — Integration Test Harness (CAMS-936 / cams-4m7g0)

Exercises the three `ustDivisionCode` backfill migrations added by PR #3136 against a real MongoDB
and a real SQL Server. No mocks. Manually run; not wired into CI.

| Migration                                 | Collection                   | What it writes                               |
| ----------------------------------------- | ---------------------------- | -------------------------------------------- |
| `BACKFILL-UST-DIVISION-CODE`              | `cases`                      | `SYNCED_CASE.ustDivisionCode`                |
| `BACKFILL-APPOINTMENT-UST-DIVISION-CODES` | `trustee-appointments`       | `TRUSTEE_APPOINTMENT.divisionCodes`          |
| `BACKFILL-VERIFICATION-UST-DIVISION-CODE` | `trustee-match-verification` | `TRUSTEE_MATCH_VERIFICATION.ustDivisionCode` |

## Why one harness for three migrations

They are **sequenced**, and the ordering is the riskiest part of the rollout:

- The verification backfill copies each document's code from its own `SYNCED_CASE`, so it is a no-op
  until the case backfill has run.
- The appointment backfill has to land before trustee sync resumes. A remapped appointment
  (`['491','494']`) matches a Winchester case whether or not that case has been backfilled yet; in
  the reverse order a backfilled case (`494`) cannot match an appointment still holding only
  `['491']`, and any sync in that window leaves an `ImperfectMatch` verification behind that the
  appointment backfill does not clear.

No per-migration harness can exercise that, so `run-all` runs them in the documented production
order and `run-ordering` deliberately runs them in the wrong one.

## Why a real SQL Server and not just MongoDB

`backfill-appointment-ust-division-codes` resolves its ACMS → bare code map from
`OfficesDxtrGateway.getOffices()`, whose `ustDivisionCode` column is the `CASE` expression built by
`ustDivisionCodeSelect`:

```sql
CASE WHEN a.COURT_ID IN ('0649') THEN a.CS_DIV ELSE a.CS_DIV_ACMS END AS ustDivisionCode
```

Unit tests can only assert that SQL's **text** — their mocked recordsets already contain whatever
`ustDivisionCode` the test wants, so a query that selected the bare `CS_DIV` unconditionally would
still pass. `run-offices` is the only place the expression's actual behaviour is proven, including
the regression the court scoping exists for: court **113E**, whose codes also diverge (bare `3E1` vs
ACMS `321`) but which sits outside `UST_DIVISION_CODE_COURT_IDS`, must still return `321`.

## Containers

| Container                             | Image                                     | Port  | Purpose                        |
| ------------------------------------- | ----------------------------------------- | ----- | ------------------------------ |
| `cams-ust-division-backfills-mongodb` | `mongo:7.0`                               | 27017 | Cosmos DB stand-in             |
| `cams-ust-division-backfills-sqledge` | `mcr.microsoft.com/azure-sql-edge:latest` | 1433  | DXTR stand-in for `getOffices` |

Standalone containers, no pod and no function app — the harness calls the use-case functions
directly, the same entry points the queue handlers call.

## Prerequisites

- **Podman** running (`podman info` should succeed; on macOS `podman machine start` first)
- **Node.js** 20+ with `npx tsx` available (root `node_modules` installed)

## Quick start

```bash
# 1. SQL Edge password (8+ chars, upper/lower/digit/symbol — SQL Edge rejects weak ones)
cd test/integration/ust-division-backfills/scripts
cp .env.template .env            # set MSSQL_PASS

# 2. Start containers
./start-services.sh

# 3. Harness environment (MSSQL_PASS must match the one above)
cd ..
cp .env.local.template .env.local

# 4. Create DXTR_INT, load the offices fixture, run everything
cd ..
npm run ust-division-backfills -- seed-schema
npm run ust-division-backfills -- seed-sql
npm run ust-division-backfills -- run-all

# 5. Tear down
npm run ust-division-backfills -- clean
./ust-division-backfills/scripts/stop-services.sh
```

Both `.env` files are gitignored; the `.template` files are not.

## Commands

| Command             | What it does                                                                |
| ------------------- | --------------------------------------------------------------------------- |
| `seed-schema`       | Create `DXTR_INT` and apply the 5-table offices DDL                         |
| `seed-sql`          | Load the DXTR offices fixture rows (court 0649 + court 113E)                |
| `seed`              | Insert the Cosmos before-state documents (cleans first)                     |
| `run-offices`       | Prove `ustDivisionCodeSelect` against real SQL                              |
| `run-cases`         | `BACKFILL-UST-DIVISION-CODE` over `SYNCED_CASE`                             |
| `run-appointments`  | `BACKFILL-APPOINTMENT-UST-DIVISION-CODES` over `TRUSTEE_APPOINTMENT`        |
| `run-verifications` | `BACKFILL-VERIFICATION-UST-DIVISION-CODE` over `TRUSTEE_MATCH_VERIFICATION` |
| `run-ordering`      | Run verifications **before** cases and prove they skip rather than guess    |
| `run-all`           | `seed` + every run above in rollout order, then an idempotency pass         |
| `clean`             | Remove fixture documents and both backfill state documents                  |

`run-*` commands assert against whatever is currently in the database, so run `seed` first when
invoking them individually. `run-all` and `run-ordering` seed for you.

## Fixtures

Court 0649 is the one district where bare `CS_DIV` diverges from `CS_DIV_ACMS`. The fixture has one
case per division so both halves of each shared ACMS code are present:

| Division     | `CS_DIV` | `CS_DIV_ACMS` | Expected `ustDivisionCode` |
| ------------ | -------- | ------------- | -------------------------- |
| Chattanooga  | 491      | 491           | 491                        |
| Greeneville  | 492      | 492           | 492                        |
| Knoxville    | 493      | 493           | 493                        |
| Winchester   | 494      | **491**       | **494**                    |
| Johnson City | 495      | **492**       | **495**                    |

Plus, deliberately:

- A **113E** case, appointment and verification — all must come out untouched.
- A Chattanooga case that **already** has `ustDivisionCode: '491'` — must not be rewritten.
- A **resolved** verification — the field only drives review-queue display, so one that has left the
  queue has nothing to correct.

`PAGE_SIZE` is 2 so every backfill has to paginate. A cursor that fails to advance past documents it
skipped shows up as a run that never terminates (capped at `MAX_PAGES`) rather than passing silently
on a single page — in production that failure mode is an endlessly re-queueing migration.

## What this does not cover

- **Queue wiring.** The harness calls the use cases directly, not `handleStart`/`handlePage`/
  `handleRetry` through Azurite. That plumbing is copy-pasted from working sibling migrations, so it
  is the least likely thing to be wrong; `trustee-verification-remap` is the template if it ever
  needs covering.
- **Throttling and the safe-threshold escape.** Local MongoDB does not return 429s, so the
  backoff/escape path in the case and appointment backfills is unit-tested only.
- **The live matching path.** `dev-tools/db_scripts/scenarios/trustee-match-tn-split-divisions.ts`
  covers that — it seeds DXTR `AO_TX` rows so a real `sync-trustee-case-appointments` run produces
  the expected `IMPERFECT_MATCH`. Complementary to this harness, not overlapping.

## Last verified

2026-10-15 against branch `CAMS-936-split-shared-division-id`: 36 checks passing via `run-all`, plus
`run-ordering`. Per the note in the parent README, if `cosmos-collections.bicep` changes the shape
or indexes of the three collections above, re-check the fixtures here.
