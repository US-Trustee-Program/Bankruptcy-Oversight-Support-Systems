# Testing Trustee Migration Enhancements (CAMS-596)

This guide covers local testing for all three slices of the CAMS-596 trustee migration
enhancements: active-only filtering, ACMS professional ID import, and Zoom CSV import.

## What Was Built

| Slice | Name | Key Change |
|---|---|---|
| 1 | Active-Only Trustee Filter | Only trustees with at least one `active`-status appointment are migrated from ATS |
| 2 | ACMS Professional ID Import | Each migrated trustee is linked to their ACMS `GROUP_DESIGNATOR-PROF_CODE` IDs |
| 3 | Zoom CSV Import | Trustees are enriched with Zoom meeting info (including `accountEmail`) from a TSV file in Blob Storage |

## Prerequisites

1. **VPN** — Connect to the USTPBNC VPN to reach ATS and ACMS SQL databases.

2. **Environment variables** — `backend/.env` must contain:
   ```
   # ATS database (Slice 1 + 2)
   ATS_MSSQL_HOST=sql-ustp-cams.database.usgovcloudapi.net
   ATS_MSSQL_DATABASE=ATS_SUB
   ATS_MSSQL_USER=CloudSA32e9dec1
   ATS_MSSQL_PASS=<password>
   ATS_MSSQL_ENCRYPT=true
   ATS_MSSQL_TRUST_UNSIGNED_CERT=true

   # ACMS database (Slice 2)
   ACMS_MSSQL_HOST=<acms-host>
   ACMS_MSSQL_DATABASE=<acms-db>
   ACMS_MSSQL_USER=<user>
   ACMS_MSSQL_PASS=<password>

   # MongoDB (all slices)
   MONGO_CONNECTION_STRING=mongodb://localhost:27017
   COSMOS_DATABASE_NAME=cams-local

   # Azure Storage (Slice 3 — queue trigger, no connection string needed)
   AzureWebJobsStorage=<azure-storage-connection-string>
   CAMS_OBJECT_CONTAINER=migration-files

   # Feature flags
   CAMS_ENABLED_DATAFLOWS=SYNC_OFFICE_STAFF,LOAD_E2E_DB,MIGRATE_TRUSTEES
   ```

3. **MongoDB** — Running locally or accessible via `MONGO_CONNECTION_STRING`.

4. **Azure Storage** — For Slice 3 Zoom CSV testing, authenticate with `az login`. The script
   triggers the deployed Azure Function by enqueuing a message on the `import-zoom-csv-start`
   queue. The function reads `zoom-info.tsv` from Blob Storage using its managed identity.
   Requires `AzureWebJobsStorage` (Azure Storage connection string) in `backend/.env`.

---

## Scripts Reference

All script commands must be run **from the repository root** with the `--tsconfig` flag:

```
npx tsx --tsconfig backend/tsconfig.json <script-path> <command>
```

### Migration script (Slices 1 + 2)

Path: `test/migration/trustee/scripts/test-trustee-migration-local.ts`

| Command | Description |
|---|---|
| `test` | Test ATS database connection and show trustee count |
| `preview [n]` | Preview first `n` trustees without migrating |
| `state` | Show current migration state (status, counts, last ID) |
| `run [size]` | Migrate a batch of `size` trustees (default: 10) |
| `reset` | Reset migration state so next `run` starts from the beginning |
| `clean` | Delete all appointments and reset state |

### Active status check (Slice 1)

Path: `test/migration/trustee/scripts/check-active-status.ts`

Queries the ATS `CHAPTER_DETAILS` table directly. No arguments — just run it:

```bash
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/check-active-status.ts
```

Shows: all distinct STATUS values with counts, trustees with at least one active appointment,
trustees with no appointments, and total trustee counts.

### Test data seeder (Slices 2 + 3)

Path: `test/migration/trustee/scripts/seed-test-trustees.ts`

Directly inserts synthetic fixtures into MongoDB. No VPN or ATS connection required.

| Command | Description |
|---|---|
| `seed-proid` | Create 3 trustees WITH professional IDs + 3 WITHOUT |
| `seed-match-verification` | Create `TrusteeMatchVerification` docs for all Slice 3 outcomes |
| `list` | Show all seeded test data currently in MongoDB |
| `clean` | Delete only seeded test data (SEED Test trustees, proIds, TST-/SEED- verifications) |
| `clean-all` | Delete **all** trustee data regardless of origin — use to fully reset dev Cosmos DB |

```bash
# Seed trustees with and without professional IDs
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/seed-test-trustees.ts \
  seed-proid

# Seed TrusteeMatchVerification documents for all Slice 3 outcomes
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/seed-test-trustees.ts \
  seed-match-verification

# List seeded data currently in MongoDB
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/seed-test-trustees.ts \
  list

# Remove only seeded test data (SEED Test trustees + TST-/SEED- verifications)
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/seed-test-trustees.ts \
  clean

# Remove ALL trustee data (full dev Cosmos DB reset)
# Wipes: trustees, trustee-appointments, trustee-professional-ids,
#        trustee-match-verification, and trustee-related runtime-state entries
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/seed-test-trustees.ts \
  clean-all
```

### Zoom CSV import script (Slice 3)

Path: `test/migration/trustee/scripts/run-zoom-csv-import.ts`

Triggers the deployed `importZoomCsv` Azure Function by sending a message to the
`import-zoom-csv-start` Azure Storage Queue. Uses `az login` credentials — no connection string
required. The function reads `zoom-info.tsv` from Blob Storage using its managed identity.

| Command | Description |
|---|---|
| `run` | Enqueue a start message to trigger the importZoomCsv dataflow in Azure |
| `report` | Show the latest `ZOOM_CSV_IMPORT_STATE` document from MongoDB |
| `clean` | Delete the `ZOOM_CSV_IMPORT_STATE` document from MongoDB |

```bash
# Trigger the import (requires: AzureWebJobsStorage in backend/.env)
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/run-zoom-csv-import.ts \
  run

# View the import report once the function completes (failed rows, counts)
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/run-zoom-csv-import.ts \
  report

# Delete the state document when done
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/run-zoom-csv-import.ts \
  clean
```

---

## Slice 1: Active-Only Trustee Filter

### What to verify

The ATS gateway's `getTrusteesPage` and `getTrusteeCount` now include a `WHERE EXISTS` subquery
on `CHAPTER_DETAILS` that filters to trustees with at least one appointment whose `STATUS` maps
to `active`. The active status codes are: `P, PA, O, C, S, E, V, 1, 8, 12`.

### Testing workflow

**Step 1 — Check active status distribution in ATS:**

```bash
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/check-active-status.ts
```

Compare `Trustees with any known STATUS code` to `Total rows in TRUSTEES`. The difference is
the number of trustees that will be skipped by the active-only filter.

**Step 2 — Preview the filtered trustees:**

```bash
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/test-trustee-migration-local.ts \
  preview 10
```

All previewed trustees should have at least one appointment. Trustees with only inactive/resigned
appointments will not appear.

**Step 3 — Run a small batch and verify:**

```bash
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/test-trustee-migration-local.ts \
  run 20
```

Then verify in MongoDB:

```javascript
// All migrated trustees should have at least one active appointment
// (There is no direct appointment status field on the trustee doc itself;
// verify by cross-referencing with CHAPTER_DETAILS in ATS)
db.trustees.find({ documentType: 'TRUSTEE' }).limit(5)
```

---

## Slice 2: ACMS Professional ID Import

### What to verify

After migrating a trustee, `upsertProfessionalIds` queries the ACMS `CMMPR` table by
`FIRST_NAME`, `LAST_NAME`, and `STATE` (filtered to `PROF_TYPE='TR'`) and stores matching
records as `TrusteeProfessionalId` documents in the `trustee-professional-ids` collection.
Format: `GROUP_DESIGNATOR-PADDED_CODE` (e.g. `NY-00063`).

Trustees with no ACMS match are migrated successfully with no professional ID record — this is
expected and not an error.

### Testing with real migration data

**Run a migration batch** (requires VPN + ACMS credentials):

```bash
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/test-trustee-migration-local.ts \
  run 50
```

**Verify in MongoDB:**

```javascript
// Count professional ID records
db['trustee-professional-ids'].countDocuments()

// View sample records
db['trustee-professional-ids'].find().limit(10)

// Find trustees WITH professional IDs
db['trustee-professional-ids'].distinct('camsTrusteeId')

// Cross-reference: look up a specific trustee's proIds
db['trustee-professional-ids'].find({ camsTrusteeId: '<trusteeId>' })

// Find trustees WITHOUT professional IDs (migrated but no ACMS match)
const trusteesWithProIds = db['trustee-professional-ids'].distinct('camsTrusteeId');
db.trustees.find({
  documentType: 'TRUSTEE',
  trusteeId: { $nin: trusteesWithProIds }
}).limit(10)
```

### Testing with synthetic seed data (no VPN needed)

Use this when you want controlled positive/negative cases without running the full migration:

```bash
# Seed 3 trustees WITH proIds and 3 WITHOUT
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/seed-test-trustees.ts \
  seed-proid

# Verify the seed
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/seed-test-trustees.ts \
  list
```

**Seeded trustees:**

| Name | State | proId |
|---|---|---|
| SEED Test Alice Proid | NY | `NY-SEED-001` |
| SEED Test Bob Proid | CA | `CA-SEED-002` |
| SEED Test Carol Proid | TX | `TX-SEED-003` |
| SEED Test David Noproid | FL | (none) |
| SEED Test Eve Noproid | IL | (none) |
| SEED Test Frank Noproid | OH | (none) |

**Verify in MongoDB:**

```javascript
// Positive cases — should have proId records
db['trustee-professional-ids'].find({ acmsProfessionalId: /^NY-SEED|^CA-SEED|^TX-SEED/ })

// Negative cases — no proId records for these trusteeIds
const seedTrustees = db.trustees.find({ name: /^SEED Test/ }).toArray();
const withoutProId = seedTrustees.filter(t =>
  !db['trustee-professional-ids'].findOne({ camsTrusteeId: t.trusteeId })
);
// Should return the 3 Noproid trustees
```

---

## Slice 3: Zoom CSV Import

### What to verify

The `ImportZoomCsv` dataflow reads `zoom-info.tsv` from Azure Blob Storage
(`CAMS_OBJECT_CONTAINER` container), parses each TSV row, matches trustees by normalized
`fullName`, and updates `zoomInfo` on the matched trustee. The `ZoomInfo` type now includes
an optional `accountEmail` field.

**Match outcomes:**

| Outcome | Behavior |
|---|---|
| Exact name match (1 trustee) | `zoomInfo` updated; `accountEmail` normalized (blank → `undefined`) |
| No match | Row logged as `UNMATCHED`, skipped |
| Multiple matches | Row logged as `AMBIGUOUS`, skipped |
| Error | Row logged as `error`, processing continues |

### TSV file format

The file must be tab-delimited with a header row. Zoom info columns start at index 2:

```
col 0   col 1   col 2       col 3          col 4       col 5     col 6   col 7
<skip>  <skip>  Full Name   Account Email  Meeting ID  Passcode  Phone   Link
```

Example `zoom-info.tsv`:
```
ID	Region	Full Name	Account Email	Meeting ID	Passcode	Phone	Link
1	East	Alice Proid	alice@example.com	123456789	pass1	555-0100	https://zoom.us/j/123456789
2	West	Bob Proid		234567890	pass2	555-0200	https://zoom.us/j/234567890
```

Note: row 2 has a blank `Account Email` — this is valid and is stored as `undefined` in `ZoomInfo`.

### Testing Zoom CSV import locally

**Option A — Run via Azure Functions runtime:**

1. Build and start the dataflows function app:
   ```bash
   npm run build:dataflows
   npm run start:dataflows
   ```

2. Upload your `zoom-info.tsv` to Azure Blob Storage in the `migration-files` container
   (or whichever container `CAMS_OBJECT_CONTAINER` points to).

3. Trigger the import by enqueuing a start message on the `IMPORT_ZOOM_CSV-start` queue,
   or by using the Azure Functions runtime portal.

4. Monitor output in the terminal running the functions runtime.

**Option B — Trigger via queue message (no Azure Functions runtime needed locally):**

Use `run-zoom-csv-import.ts` to enqueue a start message. The deployed function picks it
up and runs against the real blob storage and MongoDB:

```bash
# Trigger (requires: AzureWebJobsStorage in backend/.env)
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/run-zoom-csv-import.ts run

# View results once the function has completed
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/run-zoom-csv-import.ts report
```

### Verifying results in MongoDB

```javascript
// Find trustees whose zoomInfo was updated
db.trustees.find({ 'zoomInfo.link': { $exists: true } }).limit(10)

// Spot-check a specific trustee's zoomInfo
db.trustees.findOne({ name: 'Alice Proid' }, { zoomInfo: 1 })
// Expected: { zoomInfo: { link: '...', phone: '...', meetingId: '...', passcode: '...', accountEmail: '...' } }

// Find trustees with accountEmail set
db.trustees.find({ 'zoomInfo.accountEmail': { $exists: true } }).count()

// Find trustees whose zoomInfo was updated but accountEmail was blank (normalized to absent)
db.trustees.find({
  'zoomInfo.link': { $exists: true },
  'zoomInfo.accountEmail': { $exists: false }
})
```

### Testing match verification outcomes (CAMS-713 Slice 3)

The `sync-trustee-appointments` dataflow writes `TrusteeMatchVerification` documents for all
non-auto-match outcomes. Use the seeder to pre-populate these scenarios:

```bash
npx tsx --tsconfig backend/tsconfig.json \
  test/migration/trustee/scripts/seed-test-trustees.ts \
  seed-match-verification
```

**Seeded verification documents:**

| caseId | mismatchReason | status | What it tests |
|---|---|---|---|
| `SEED-091-11-00001` | `NO_TRUSTEE_MATCH` | `pending` | Normal actionable case |
| `SEED-091-11-00002` | `MULTIPLE_TRUSTEES_MATCH` | `pending` | Normal actionable case |
| `SEED-091-11-00003` | `IMPERFECT_MATCH` | `pending` | Normal actionable case |
| `SEED-091-11-00004` | `HIGH_CONFIDENCE_MATCH` | `pending` | Normal actionable case |
| `SEED-091-11-00005` | `NO_TRUSTEE_MATCH` | `approved` | `upsertMatchVerification` skips resolved docs |
| `SEED-091-11-00006` | `IMPERFECT_MATCH` | `rejected` | `upsertMatchVerification` skips dismissed docs |

**Verify in MongoDB:**

```javascript
// All seeded verifications
db['trustee-match-verification'].find({ caseId: /^SEED-/ })

// Pending — the actionable work queue
db['trustee-match-verification'].find({ caseId: /^SEED-/, status: 'pending' })

// Already resolved/dismissed — should be skipped by upsertMatchVerification
db['trustee-match-verification'].find({ caseId: /^SEED-/, status: { $ne: 'pending' } })
```

---

## Full End-to-End Testing Workflow

This sequence exercises all three slices together:

```bash
# 0. (Optional) Full reset — wipe all stale trustee data before starting fresh
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts clean-all

# 1. Verify ATS connection and active trustee counts (Slice 1)
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/test-trustee-migration-local.ts test

npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/check-active-status.ts

# 2. Run a small migration batch (Slices 1 + 2 together)
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/test-trustee-migration-local.ts run 20

# 3. Check state
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/test-trustee-migration-local.ts state

# 4. Seed synthetic proId scenarios for controlled testing (Slice 2)
# if a clean slate is needed: npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts clean-all
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts seed-proid

# 5. Seed match verification scenarios (CAMS-713 Slice 3)
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts seed-match-verification

# 6. Trigger Zoom CSV import and view results (Slice 3)
#    Requires: AzureWebJobsStorage in backend/.env
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/run-zoom-csv-import.ts run
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/run-zoom-csv-import.ts report

# 7. Verify everything
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts list

# 8. Clean up synthetic seed data when done
npx tsx --tsconfig backend/tsconfig.json test/migration/trustee/scripts/seed-test-trustees.ts clean
```

---

## Resetting and Re-running

| Goal | Command |
|---|---|
| Re-run migration from scratch | `test-trustee-migration-local.ts clean` then `run` |
| Reset migration state only (keep trustees) | `test-trustee-migration-local.ts reset` |
| Remove only synthetic seed data | `seed-test-trustees.ts clean` |
| Remove all seeded data and restart migration | Both clean commands, then `run` |
| **Full dev DB reset** (stale data from many runs) | `seed-test-trustees.ts clean-all` then `run` |

---

## Running Unit Tests

```bash
# Slice 1 — Active-only filter
cd backend && npm test -- lib/adapters/gateways/ats/ats.gateway.test.ts

# Slice 2 — Professional ID import
cd backend && npm test -- lib/use-cases/dataflows/migrate-trustees.test.ts

# Slice 3 — Zoom CSV use case
cd backend && npm test -- lib/use-cases/dataflows/import-zoom-csv.test.ts

# Slice 3 — Zoom CSV function trigger
cd backend && npm test -- function-apps/dataflows/migrations/import-zoom-csv.test.ts

# All ATS mapping tests
cd backend && npm test -- lib/adapters/gateways/ats/ats-mappings.test.ts

# ZoomInfo validation (accountEmail)
cd common && npm test -- src/cams/trustees-validators.test.ts
```
