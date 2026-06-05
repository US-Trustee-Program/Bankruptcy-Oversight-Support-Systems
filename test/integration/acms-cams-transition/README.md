# ACMS-CAMS Transition Integration Testing

One-shot integration harnesses for the ACMS-CAMS transition database layer, including the CAMS-616 trustee appointment downstream flow.

**Intended executor:** AI agent running from `test/integration/`. All SQL operations go through the TypeScript harness — no `sqlcmd` required.

**Not** Vitest unit tests. **Not** Playwright e2e tests. These seed real databases, invoke real use cases against lower-environment infrastructure, and assert the expected state.

**Never commit credentials.** All configuration lives in gitignored files — see Prerequisites.

**Database topology:** All objects live in `ACMS_REP_SUB` alongside the existing ACMS `CMMAP` table:
- `CMMAP_CAMS` — CAMS-sourced appointments (audit trail and CAMS-specific downstream feed)
- `CMMAP_ALL` — unified authoritative table; downstream consumers query this instead of `CMMAP`
- `CMMAP_SYNC_CONTROL` — daily sync watermark

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

---

## Part 1: Database setup (first time only)

Run these once to create and seed the schema objects in `ACMS_REP_SUB`.

### Step 1 — Verify environment
```bash
$HARNESS check-env
```
All lines must show `✓ PASS`. Resolve any `✗ FAIL` before proceeding.

### Step 2 — Apply schema
Creates `CMMAP_CAMS` table, `CMMAP_ALL` table, and `CMMAP_SYNC_CONTROL` table in `ACMS_REP_SUB`.
```bash
$HARNESS seed-schema
```

### Step 3 — Seed mock ACMS replica data
Seeds `CMMAP`, `CMMPR`, `CMMPT` tables with 6 test case appointments.
```bash
$HARNESS seed-sql
```
This also seeds `CMMAP_CAMS` (3 S1 + 1 TR) and `CMMAP_ALL` (4 ACMS rows + 4 CAMS rows = 7 effective rows).

---

## Part 2: CMMAP_ALL table SQL tests

Run the 9-test assertion script to verify `CMMAP_ALL` contains the correct unified appointment state.

```bash
$HARNESS run-sql test/integration/acms-cams-transition/integration-tests/test-cmmap-all.sql ACMS_REP_SUB
```

**All 9 tests must print `✓ PASS`.** If any print `✗ FAIL`, the schema or seed data is incorrect.

| Test | What it verifies |
|---|---|
| 1–2 | ACMS-only TR/S1 cases appear with SOURCE='ACMS' |
| 3 | CAMS S1 override appears with SOURCE='CAMS'; ACMS row excluded |
| 4 | CAMS-only S1 case appears with SOURCE='CAMS' |
| 5 | Inactive CAMS S1 (APPTEE_ACTIVE=N) still appears |
| 6 | Total row count = 7 (4 ACMS + 4 CAMS − 1 S1 override − 1 TR override) |
| 7 | No duplicate (case, APPT_TYPE) combinations |
| 8 | CAMS TR row for case 081-24-55555 overrides ACMS TR row |
| 9 | CMMAP_SYNC_CONTROL has ACMS_DAILY control row |

---

## Part 3: Trustee appointment downstream flow (CAMS-616)

Tests the full pipeline: `processAppointments` use case → Azure Storage Queue → `trustee-appointment-handler` → `CMMAP_CAMS` + `CMMAP_ALL` (dual-write).

### Step 1 — Seed Cosmos with trustee↔professional ID mapping
```bash
$HARNESS seed-integration
```

### Step 2 — Start the downstream handler locally
```bash
cd backend/function-apps/dataflows && npm start
```
Leave this running during Step 3.

### Step 3 — Run the integration test
```bash
$HARNESS run
```
This calls `processAppointments`, emits a `TrusteeAppointmentDownstreamEvent`, and the handler writes to both `CMMAP_CAMS` and `CMMAP_ALL` in a single transaction.

**Expected output:**
- `✓ PASS: processAppointments completed without DLQ errors`
- `✓ PASS: Found 1 row(s) in CMMAP_CAMS for case <TEST_CASE_ID>`
- `✓ PASS: TR row has APPT_DISP='GR'`
- `✓ PASS: TR row SOURCE='CAMS'`
- `✓ PASS: CMMAP_ALL has 1 CAMS-sourced row(s) for case <TEST_CASE_ID>`

### Step 4 — Confirm CMMAP_CAMS (optional read-only check)
```bash
$HARNESS check-staging
```

---

## Cleanup

```bash
# Remove test data inserted by harness (Cosmos, CMMAP_CAMS, CMMAP_ALL)
$HARNESS clean

# Re-seed if needed (seed scripts are idempotent — they drop and recreate data)
$HARNESS seed-sql
```

---

## Structure

```
test/integration/acms-cams-transition/
├── seed/
│   ├── 01-seed-acms-replica.sql          # Mock ACMS CMMAP/CMMPR/CMMPT rows (6 appointments)
│   ├── 02-seed-cmmap-cams.sql            # Mock CAMS rows for CMMAP_CAMS (3 S1 + 1 TR)
│   ├── 03-seed-cmmap-all.sql             # Unified seed for CMMAP_ALL (4 ACMS + 4 CAMS rows)
│   └── README.md
├── integration-tests/
│   └── test-cmmap-all.sql                # 9 PRINT-based assertions for CMMAP_ALL table
├── scripts/
│   └── test-trustee-appointment-downstream.ts   # All-in-one harness (setup + test + clean)
└── README.md (this file)
```
