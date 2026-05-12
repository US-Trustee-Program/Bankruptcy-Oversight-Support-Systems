# ACMS-CAMS Transition Integration Testing

One-shot integration harnesses for the ACMS-CAMS transition database layer, including the CAMS-616 trustee appointment downstream flow.

These are **manual test scripts** — not Vitest unit tests, not Playwright e2e tests. They seed real databases, invoke real use cases against lower-environment infrastructure, and query databases to assert the expected state changes occurred.

**IMPORTANT:** Never commit credentials or connection strings. All configuration lives in gitignored files — see Prerequisites below.

## Structure

```
test/integration/acms-cams-transition/
├── seed/
│   ├── 01-seed-acms-replica.sql          # Mock ACMS data (CMMAP, CMMPR, CMMPT)
│   ├── 02-seed-cmmap-staging.sql         # Mock CAMS staging data (S1 and TR rows)
│   └── README.md
├── integration-tests/
│   └── test-cmmap-view.sql               # SQL assertions for CMMAP union view (8 tests)
├── scripts/
│   └── test-trustee-appointment-downstream.ts   # CAMS-616 TypeScript harness
└── README.md (this file)
```

---

## Part 1: CMMAP View SQL Tests

Tests that the `CMMAP` union view merges CAMS staging and ACMS replica rows correctly, with CAMS overriding ACMS per `(case, APPT_TYPE)`.

### Prerequisites

- Local or Azure SQL Server with databases `acms_replica_test` and `cams_downstream_test`
- Schema applied: `downstream/database/acms-cams-transition/schema/` run on `cams_downstream_test`
- `sqlcmd` available in PATH

### Run

```bash
# From repo root — seed both databases
sqlcmd -S <server> -d acms_replica_test \
  -i test/integration/acms-cams-transition/seed/01-seed-acms-replica.sql

sqlcmd -S <server> -d cams_downstream_test \
  -i test/integration/acms-cams-transition/seed/02-seed-cmmap-staging.sql

# Run 8-test view assertion script
sqlcmd -S <server> -d cams_downstream_test \
  -i test/integration/acms-cams-transition/integration-tests/test-cmmap-view.sql
```

### Expected output: all 8 tests print `✓ PASS`

| Test | Scenario |
|---|---|
| 1–3 | ACMS-only TR cases pass through unchanged |
| 4 | CAMS-only S1 case passes through |
| 5 | Inactive CAMS S1 (APPTEE_ACTIVE=N) still appears |
| 6 | Total count = 8 (6 ACMS + 4 CAMS − 2 overrides) |
| 7 | No duplicate (case, APPT_TYPE) combinations |
| 8 | CAMS TR row for case 55555 overrides ACMS TR row (CAMS-616) |

---

## Part 2: Trustee Appointment Downstream Harness (CAMS-616)

Tests the full downstream flow: `processAppointments` use case → queue → `CMMAP_STAGING`.

### Prerequisites

**1. `backend/.env`** — primary config (gitignored via `backend/.gitignore`):

```bash
# Cosmos DB / MongoDB
MONGO_CONNECTION_STRING=mongodb+srv://...
COSMOS_DATABASE_NAME=cams-dev

# DXTR SQL (read-only)
MSSQL_HOST=<dxtr-server>.database.usgovcloudapi.net
MSSQL_DATABASE_DXTR=<dxtr-database>
MSSQL_ENCRYPT=true
MSSQL_TRUST_UNSIGNED_CERT=false
# MSSQL_USER=<user>      # omit if using Azure AD default auth
# MSSQL_PASS=<password>

# Downstream Azure SQL (CMMAP_STAGING)
DOWNSTREAM_SQL_CONNECTION_STRING=Server=tcp:<server>.database.usgovcloudapi.net,1433;Database=<db>;...

# Optional: override test fixture values
INTEGRATION_TEST_TRUSTEE_ID=<a real CAMS trustee ID in lower-env Cosmos>
INTEGRATION_TEST_ACMS_PROF_ID=<matching ACMS professional ID, e.g. NY-00063>
INTEGRATION_TEST_CASE_ID=<a case ID that exists in lower-env DXTR>
INTEGRATION_TEST_COURT_ID=<the court ID for that case>
```

**2. `backend/function-apps/dataflows/local.settings.json`** — provides `AzureWebJobsDataflowsStorage` (gitignored via `backend/.gitignore`):

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "<lower-env Azure Storage connection string>",
    "AzureWebJobsDataflowsStorage": "<lower-env Azure Storage connection string>"
  }
}
```

The harness loads this file's `Values` into `process.env` at startup, exactly as the Functions runtime does locally. This makes `AzureWebJobsDataflowsStorage` available to `ApiToDataflowsGatewayImpl` so it can write to the storage queue.

**3. `downstream/functions/local.settings.json`** — required when running the downstream handler locally (gitignored via `downstream/.gitignore`):

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "<lower-env Azure Storage connection string>",
    "DOWNSTREAM_SQL_CONNECTION_STRING": "<lower-env downstream SQL connection string>",
    "FUNCTIONS_WORKER_RUNTIME": "node"
  }
}
```

### Commands

```bash
# From repo root:
npx tsx --tsconfig backend/tsconfig.json \
  test/integration/acms-cams-transition/scripts/test-trustee-appointment-downstream.ts [command]
```

| Command | Description |
|---|---|
| `check-env` | Verify all required env vars are present (run this first) |
| `seed-cosmos` | Upsert a `TrusteeProfessionalId` doc linking test trustee to ACMS professional ID |
| `run` | Call `processAppointments` with the test event; assert CMMAP_STAGING state |
| `check-staging` | Print current CMMAP_STAGING rows for the test case (read-only) |
| `clean` | Delete test rows from CMMAP_STAGING; report Cosmos doc for manual removal |
| `help` | Show command reference |

### Recommended workflow

```bash
# 1. Verify environment
npx tsx --tsconfig backend/tsconfig.json \
  test/integration/acms-cams-transition/scripts/test-trustee-appointment-downstream.ts check-env

# 2. Seed Cosmos with trustee ↔ ACMS professional ID mapping
npx tsx --tsconfig backend/tsconfig.json \
  test/integration/acms-cams-transition/scripts/test-trustee-appointment-downstream.ts seed-cosmos

# 3. Start downstream handler locally (separate terminal — consumes from queue)
cd downstream/functions && func start

# 4. Run the harness — invokes processAppointments, which emits to the storage queue
npx tsx --tsconfig backend/tsconfig.json \
  test/integration/acms-cams-transition/scripts/test-trustee-appointment-downstream.ts run

# 5. Confirm CMMAP_STAGING after the downstream handler processes the queue message
npx tsx --tsconfig backend/tsconfig.json \
  test/integration/acms-cams-transition/scripts/test-trustee-appointment-downstream.ts check-staging

# 6. Clean up when done
npx tsx --tsconfig backend/tsconfig.json \
  test/integration/acms-cams-transition/scripts/test-trustee-appointment-downstream.ts clean
```

### Expected assertions

- `processAppointments` returns `successCount >= 1`, `dlqMessages.length === 0`
- CMMAP_STAGING has a row for the test case with `APPT_TYPE='TR'`, `SOURCE='CAMS'`
- Active appointment: `APPT_DISP='GR'`, `APPTEE_ACTIVE='Y'`
- Closed appointment (if `unassignedOn` present): `APPT_DISP='WD'`, `APPTEE_ACTIVE='N'`, `DISP_DATE` set

---

## Cleanup

```bash
# Drop local test databases when done with SQL tests
sqlcmd -Q "DROP DATABASE acms_replica_test;"
sqlcmd -Q "DROP DATABASE cams_downstream_test;"

# Remove TypeScript harness test data from lower env
npx tsx --tsconfig backend/tsconfig.json \
  test/integration/acms-cams-transition/scripts/test-trustee-appointment-downstream.ts clean
```
