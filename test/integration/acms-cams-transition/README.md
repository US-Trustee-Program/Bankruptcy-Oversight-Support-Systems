# ACMS-CAMS Transition Integration Testing

One-shot integration harnesses for the ACMS-CAMS transition database layer, including the CAMS-616 trustee appointment downstream flow.

**Intended executor:** AI agent running from `test/integration/`. All SQL operations go through the TypeScript harness — no `sqlcmd` required.

**Not** Vitest unit tests. **Not** Playwright e2e tests. These seed real databases, invoke real use cases against lower-environment infrastructure, and assert the expected state.

**Never commit credentials.** All configuration lives in gitignored files — see Prerequisites.

**Database topology:** All objects (`CMMAP_STAGING`, `CMMAP_TRANSITION` view) live in `ACMS_REP_SUB` alongside the existing ACMS `CMMAP` table. No separate transition database is needed.

---

## Harness shorthand

All commands run from `test/integration/` via the npm script:

```
HARNESS="npm run acms-cams-transition --"
```

File path arguments to `run-sql` are resolved relative to the repo root.

---

## Prerequisites

Verify these gitignored files exist and are populated before running anything.

**`backend/.env`** — must contain:
```
MONGO_CONNECTION_STRING=<lower-env Cosmos connection string>
COSMOS_DATABASE_NAME=<lower-env Cosmos database name>
ACMS_MSSQL_HOST=sql-ustp-cams.database.usgovcloudapi.net
ACMS_MSSQL_DATABASE=ACMS_REP_SUB
ACMS_MSSQL_USER=<sql user>
ACMS_MSSQL_PASS=<sql password>
ACMS_MSSQL_ENCRYPT=true
ACMS_MSSQL_TRUST_UNSIGNED_CERT=true
MSSQL_HOST=sql-ustp-cams.database.usgovcloudapi.net
MSSQL_DATABASE_DXTR=AODATEX_SUB
INTEGRATION_TEST_TRUSTEE_ID=<a real CAMS trustee ID in lower-env Cosmos>
INTEGRATION_TEST_ACMS_PROF_ID=<that trustee's ACMS professional ID, e.g. NY-00063>
INTEGRATION_TEST_CASE_ID=<a case ID that exists in lower-env DXTR for that trustee>
INTEGRATION_TEST_COURT_ID=<the court ID for that case>
```

**`backend/function-apps/dataflows/local.settings.json`** — must contain:
```json
{
  "Values": {
    "AzureWebJobsDataflowsStorage": "<lower-env Azure Storage connection string>",
    "AzureWebJobsStorage": "<lower-env Azure Storage connection string>",
    "FUNCTIONS_WORKER_RUNTIME": "node"
  }
}
```

**`downstream/functions/local.settings.json`** — required when running the downstream handler locally:
```json
{
  "Values": {
    "AzureWebJobsStorage": "<lower-env Azure Storage connection string>",
    "ACMS_MSSQL_HOST": "sql-ustp-cams.database.usgovcloudapi.net",
    "ACMS_MSSQL_DATABASE": "ACMS_REP_SUB",
    "ACMS_MSSQL_USER": "<sql user>",
    "ACMS_MSSQL_PASS": "<sql password>",
    "ACMS_MSSQL_ENCRYPT": "true",
    "ACMS_MSSQL_TRUST_UNSIGNED_CERT": "true",
    "FUNCTIONS_WORKER_RUNTIME": "node"
  }
}
```

---

## Part 1: Database setup (first time only)

Run these once to create and seed the schema objects in `ACMS_REP_SUB`.

### Step 1 — Verify environment
```bash
$HARNESS check-env
```
All lines must show `✓ PASS`. Resolve any `✗ FAIL` before proceeding.

### Step 2 — Apply schema
Creates `CMMAP_STAGING` table and `CMMAP_TRANSITION` view in `ACMS_REP_SUB`.
```bash
$HARNESS run-sql downstream/database/acms-cams-transition/schema/cmmap-staging.sql ACMS_REP_SUB
$HARNESS run-sql downstream/database/acms-cams-transition/schema/cmmap-view.sql ACMS_REP_SUB
```

### Step 3 — Seed mock ACMS replica data
Seeds `CMMAP`, `CMMPR`, `CMMPT` tables in `ACMS_REP_SUB` with 6 test case appointments (3 TR, 2 S1, 1 TR that will be overridden by CAMS).
```bash
$HARNESS run-sql test/integration/acms-cams-transition/seed/01-seed-acms-replica.sql ACMS_REP_SUB
```

### Step 4 — Seed CAMS staging data
Seeds `CMMAP_STAGING` in `ACMS_REP_SUB` with 4 test rows (3 S1, 1 TR).
```bash
$HARNESS run-sql test/integration/acms-cams-transition/seed/02-seed-cmmap-staging.sql ACMS_REP_SUB
```

---

## Part 2: CMMAP_TRANSITION view SQL tests

Run the 8-test assertion script to verify the `CMMAP_TRANSITION` union view merges CAMS staging and ACMS replica rows correctly.

```bash
$HARNESS run-sql test/integration/acms-cams-transition/integration-tests/test-cmmap-view.sql ACMS_REP_SUB
```

**All 8 tests must print `✓ PASS`.** If any print `✗ FAIL`, the view or seed data is incorrect — do not proceed to Part 3.

| Test | What it verifies |
|---|---|
| 1–3 | ACMS-only TR cases pass through the view unchanged |
| 4 | CAMS-only S1 case passes through |
| 5 | Inactive CAMS S1 (APPTEE_ACTIVE=N) still appears |
| 6 | Total row count = 8 (6 ACMS + 4 CAMS staging − 2 overrides) |
| 7 | No duplicate (case, APPT_TYPE) combinations in view |
| 8 | CAMS TR row for case 081-24-55555 overrides ACMS TR row (CAMS-616) |

---

## Part 3: Trustee appointment downstream flow (CAMS-616)

Tests the full pipeline: `processAppointments` use case → Azure Storage Queue → `trustee-appointment-handler` → `CMMAP_STAGING`.

### Step 1 — Seed Cosmos with trustee↔professional ID mapping
```bash
$HARNESS seed-cosmos
```
This upserts a `TrusteeProfessionalId` document linking `INTEGRATION_TEST_TRUSTEE_ID` to `INTEGRATION_TEST_ACMS_PROF_ID`. If these already exist in lower-env Cosmos from real data, this step can be skipped.

### Step 2 — Start the downstream handler locally
In a separate terminal, start the downstream Azure Function so it consumes messages from the queue and writes to `CMMAP_STAGING`:
```bash
cd downstream/functions && func start
```
Leave this running during Step 3.

### Step 3 — Run the integration test
```bash
$HARNESS run
```
This calls `processAppointments` with the test `TrusteeAppointmentSyncEvent`. The use case matches the trustee, writes to Cosmos, and emits a `TrusteeAppointmentDownstreamEvent` to the Azure Storage Queue. The downstream handler (running in Step 2) picks it up and writes to `CMMAP_STAGING`.

**Expected output:**
- `✓ PASS: processAppointments completed without DLQ errors`
- `✓ PASS: Found 1 row(s) in CMMAP_STAGING for case <TEST_CASE_ID>`
- `✓ PASS: TR row has APPT_DISP='GR'`
- `✓ PASS: TR row SOURCE='CAMS'`

### Step 4 — Confirm CMMAP_STAGING (optional read-only check)
```bash
$HARNESS check-staging
```

---

## Cleanup

```bash
# Remove test data inserted by harness
$HARNESS clean

# Re-seed if needed (seed scripts are idempotent — they drop and recreate tables)
$HARNESS run-sql test/integration/acms-cams-transition/seed/01-seed-acms-replica.sql ACMS_REP_SUB
$HARNESS run-sql test/integration/acms-cams-transition/seed/02-seed-cmmap-staging.sql ACMS_REP_SUB
```

---

## Structure

```
test/integration/acms-cams-transition/
├── seed/
│   ├── 01-seed-acms-replica.sql          # Mock ACMS CMMAP/CMMPR/CMMPT rows (6 appointments)
│   ├── 02-seed-cmmap-staging.sql         # Mock CAMS staging rows (3 S1 + 1 TR)
│   └── README.md
├── integration-tests/
│   └── test-cmmap-view.sql               # 8 PRINT-based assertions for the CMMAP_TRANSITION view
├── scripts/
│   └── test-trustee-appointment-downstream.ts   # All-in-one harness (setup + test + clean)
└── README.md (this file)
```
