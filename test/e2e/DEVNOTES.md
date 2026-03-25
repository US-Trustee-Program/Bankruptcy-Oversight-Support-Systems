# E2E Containerized Test Infrastructure — Session Notes for Claude

## Current State (as of 2026-03-26)

This document captures the in-progress work on the self-contained E2E database seeding
infrastructure so the next Claude session can pick up where this one left off.

---

## Architecture: Fixture Pipeline

```
harvest-mongo.ts     → fixtures/mongo-harvested.json      (gitignored, one-time)
harvest-sqlserver.ts → fixtures/sqlserver-harvested.json  (gitignored, one-time)
                              ↓
                  synthesize-fixtures.ts
                              ↓
fixtures/mongo-fixture.json       (committed, no PII)
fixtures/sqlserver-fixture.json   (committed, no PII)
                              ↓
seed-database.ts    → MongoDB (Faker PII regenerated at seed time)
seed-sqlserver.ts   → SQL Edge (Faker PII regenerated at seed time)
```

**Key rule:** Harvest scripts write to `*-harvested.json`. Synthesize reads from
`*-harvested.json` and writes the committed `*-fixture.json`. The synthesizer is
idempotent and safe to re-run. The harvest scripts require live DXTR credentials
and are one-time use.

---

## Required Cases

| caseId | Purpose |
|--------|---------|
| `091-69-12345` | KNOWN_GOOD_TRANSFER_TO_CASE_ID — case-notes.spec.ts, transfer suggestions |
| `081-65-67641` | KNOWN_GOOD_TRANSFER_FROM_CASE_ID — transfer-orders.spec.ts |
| `081-18-61881` | Pending transfer ORDER case AND consolidation add-case target (added via modal) |

---

## SQL Server Key Facts

- `AO_CS.CS_CASEID` is **VARCHAR(9)**, not an integer. Don't cast to number.
- `AO_CS.CASE_ID` is the `year-number` part (e.g. `69-12345`), not the full caseId.
- `AO_CS_DIV.CS_DIV_ACMS` is the 3-digit division code (e.g. `081`, `091`).
- Division codes: `081` = Manhattan (COURT_ID `0208`), `091` = Buffalo (COURT_ID `0209`).
- Transfer suggestions query (`getSuggestedCases`) matches cases by `AO_PY.PY_TAXID`.
  The FROM and TO transfer pair must share the same `PY_TAXID` — `alignTransferPairTaxId()`
  in `seed-sqlserver.ts` handles this by overwriting both rows with `TRANSFER_PAIR_TAXID`.
- `AO_TX` petition code is at SQL `SUBSTRING(REC, 108, 2)` = JS `rec.substring(107, 109)`.
  Case `091-69-12345` has petition code `TV` — confirmed in fixture.

---

## MongoDB Key Facts

- Collections seeded: `cases`, `consolidations`, `orders`, `trustees`, `user-groups`.
- `cases` collection holds `SYNCED_CASE` documents — one per required caseId.
- Trustee documents **must have a `trusteeId` UUID field** (not just `id`).
  Backend queries by `trusteeId`; nav link uses `trustee.trusteeId` for the URL.
  Current fixture: `trusteeId: 'aaaabbbb-cccc-dddd-eeee-ffff00000001'`.
- Consolidation `memberCases` must NOT pre-include `081-18-61881` — the spec adds it
  via the AddCaseModal. The real harvested consolidation has 20 members; none are `081-18-61881`.
- Consolidation documents use `memberCases` (not `childCases` — post-migration field name).

---

## Status

Fixtures re-harvested from `cams-e2e-0b30d9` (the e2e database where all specs pass).
All 4 known case IDs resolved. `081-29-56291` was absent from this dataset — replaced
with `081-18-61881` as the consolidation add-case target (updated in
`consolidation-orders.spec.ts` and `synthesize-fixtures.ts`).

**Pending**: Run `npm run e2e:reseed` to confirm all tests pass with the new fixtures.

---

## Files Changed This Session

| File | Change |
|------|--------|
| `scripts/harvest-mongo.ts` | Writes to `mongo-harvested.json` (not `mongo-fixture.json`) |
| `scripts/harvest-sqlserver.ts` | Writes to `sqlserver-harvested.json` |
| `scripts/synthesize-fixtures.ts` | Reads `*-harvested.json`; synthesizes consolidation if not in harvest; trusteeId field; idempotent |
| `scripts/seed-sqlserver.ts` | `alignTransferPairTaxId()` — shared taxId for transfer pair; String() comparison fix |
| `scripts/seed-database.ts` | Rewritten — reads fixture, applies Faker PII, seeds via MongoClient directly |
| `playwright.config.ts` | Removed Microsoft Edge project (not supported on ARM64/aarch64) |
| `playwright/case-notes.spec.ts` | `timeoutOption = { timeout: 30000 }` on beforeEach; removed afterEach logout |
| `playwright/transfer-orders.spec.ts` | Removed afterEach logout |
| `playwright/consolidation-orders.spec.ts` | Removed afterEach logout |
| `scripts/run-e2e-workflow.sh` | Suppress container listing on startup; temp-file output capture for correct exit code; parse failed/passed counts from Playwright summary |
| `Dockerfile.playwright` | Removed msedge install (ARM64 unsupported) |
| `.dockerignore` (repo root) | Created — excludes `user-interface/test-results/`, test artifacts from build context |
| `.gitignore` | Added `fixtures/*-harvested.json` |

---

## Post-Development Cleanup (TODO after all tests pass)

Once the containerized E2E tests are confirmed fully passing, these items should be deleted from the repo — they are development scaffolding only and not part of the long-term test infrastructure:

| Item | Reason |
|------|--------|
| `scripts/harvest-mongo.ts` | One-time use; requires live DXTR creds; not needed once fixtures are committed |
| `scripts/harvest-sqlserver.ts` | Same as above |
| `scripts/synthesize-fixtures.ts` | Only needed to transform harvest output → committed fixtures; done once |
| `fixtures/mongo-harvested.json` | Intermediate harvest artifact; gitignored anyway |
| `fixtures/sqlserver-harvested.json` | Intermediate harvest artifact; gitignored anyway |
| `npm run harvest:mongo` | Remove from package.json |
| `npm run harvest:sql` | Remove from package.json |
| `npm run synthesize` | Remove from package.json |

The **committed** fixtures (`mongo-fixture.json`, `sqlserver-fixture.json`) and the **replayable** seed scripts (`seed-database.ts`, `seed-sqlserver.ts`) are the permanent artifacts.

---

## npm Scripts Reference

```
npm run synthesize      # Re-generate fixtures from *-harvested.json (run after harvest or editing synthesize-fixtures.ts)
npm run seed            # Seed MongoDB from mongo-fixture.json
npm run seed:sql        # Seed SQL Edge from sqlserver-fixture.json
npm run seed:all        # Both of the above
npm run e2e             # Run tests (uses existing data)
npm run e2e:reseed      # Reseed both databases then run tests
npm run e2e:full        # Reseed + open HTML report
npm run harvest:mongo   # ONE-TIME: harvest from live DXTR → mongo-harvested.json (needs DXTR creds)
npm run harvest:sql     # ONE-TIME: harvest from live DXTR → sqlserver-harvested.json (needs DXTR creds)
npm run report          # Open last HTML report
```

---

## Test Suite

4 spec files, Chromium only (msedge removed):

```
playwright/auth-setup.ts          # Okta login, writes playwright/.auth/user.json
playwright/case-notes.spec.ts     # 1 test — create/edit/delete case note on 091-69-12345
playwright/consolidation-orders.spec.ts  # 2 tests — approve consolidation, add-case modal
playwright/transfer-orders.spec.ts       # 2 tests — transfer form, cancel reset
playwright/trustees.spec.ts              # Multiple tests — list, detail, staff assignment
```

Target: all tests passing with `npm run e2e:reseed`.

---

## Environment

- Podman VM on Apple Silicon (ARM64/aarch64)
- MongoDB: `cams-e2e` database, `mongodb://localhost:27017`
- SQL Edge: `CAMS_E2E` database, `localhost:1433`, `sa`/`YourStrong!Passw0rd`
- Backend: Azure Functions local runtime, `http://localhost:7071`
- Frontend: Vite dev server, `http://localhost:3000`
- Auth: Okta with mock login; storageState in `playwright/.auth/user.json`
- The `afterEach` logout calls were removed from specs — they were destroying
  the Okta server-side session causing subsequent tests to see "Session End" page.

### SQL Server Data Persistence

The SQL Server container persists data to `sqlserver-data/` on the host. **Do NOT `rm -rf` this
directory to "reset" the data.** The seed script already handles cleanup:
`createTable()` does `DROP TABLE IF EXISTS` + `CREATE TABLE` for every table before inserting.
Running `npm run seed:sql` (or `npm run e2e:reseed`) is sufficient — the volume does not need
to be wiped. Deleting `sqlserver-data/` forces SQL Edge to re-initialize the entire server
instance on startup, which adds ~30s to the workflow and is unnecessary.
