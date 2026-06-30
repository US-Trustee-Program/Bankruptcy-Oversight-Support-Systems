# migrate-case-appointments — Integration Smoke Test Harness

One-shot TypeScript harness that exercises the `migrate-case-appointments` dataflow end-to-end
against real local containers.

---

## 1. Containers and why each is needed

| Container                                | Image                                            | Port        | Purpose                                                                                                                |
| ---------------------------------------- | ------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `cams-mongodb-migrate-case-appointments` | `mongo:7.0`                                      | 27017       | Cosmos DB stand-in for `case-appointments`, `trustee-professional-ids`, and `runtime-state` collections                |
| `cams-sqledge-migrate-case-appointments` | `mcr.microsoft.com/azure-sql-edge:latest`        | 1433        | ACMS source — the `dbo.CMMAP` table that `getCmmapAppointments` reads                                                  |
| `cams-azurite-migrate-case-appointments` | `mcr.microsoft.com/azure-storage/azurite:latest` | 10000–10002 | Azure Storage emulator for the `migrate-case-appointments-start` queue trigger and the `migrate-case-appointments-dlq` |

All three run in the Podman pod `cams-migrate-case-appointments-pod` for shared localhost
networking.

---

## 2. Prerequisites

- **Podman** installed and running (`podman info` should succeed)
- **Node.js** 20+ with `npx tsx` available (root `node_modules` installed)
- **dataflows function app** runnable via `npm start` in `backend/function-apps/dataflows/`
- The function app's `local.settings.json` must point `AzureWebJobsStorage` at the same Azurite
  instance (matching the `AzureWebJobsStorage` in `.env.local`)

---

## 3. Quick-start sequence

```bash
# 1. Configure the SQL Edge SA password
cd test/integration/migrate-case-appointments/scripts
cp .env.template .env
# Edit .env and set MSSQL_PASS to a strong password

# 2. Configure the harness environment
cd test/integration/migrate-case-appointments
cp .env.local.template .env.local
# Edit .env.local and set ACMS_MSSQL_PASS to the same password

# 3. Start containers
cd test/integration/migrate-case-appointments/scripts
./start-services.sh

# 4. Create ACMS_INT database and apply CMMAP schema
cd test/integration
npm run migrate-case-appointments -- seed-schema

# 5. Seed CMMAP fixture rows
npm run migrate-case-appointments -- seed-sql

# 6. Seed MongoDB fixture (TrusteeProfessionalId)
npm run migrate-case-appointments -- seed-cosmos

# 7. Start the function app (separate terminal)
cd backend/function-apps/dataflows
npm start

# 8. Run the full happy-path test
cd test/integration
npm run migrate-case-appointments -- run

# 9. (Optional) Run the reset-flag test
npm run migrate-case-appointments -- run-reset

# 10. (Optional) Run the deleteAll scoping test
npm run migrate-case-appointments -- run-delete-all

# 11. Clean up test data
npm run migrate-case-appointments -- clean

# 12. Stop containers
cd test/integration/migrate-case-appointments/scripts
./stop-services.sh
```

---

## 4. What each assertion verifies

### `run` (happy path)

| Assertion                                                | What it verifies                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| 2 `case-appointments` with `source='acms'`               | Both non-deleted CMMAP records were migrated                       |
| `081-24-12345` has `trusteeId='INTEGRATION-TRUSTEE-001'` | `acmsProfessionalId='NY-00063'` was resolved to the seeded trustee |
| `081-24-12345` has `assignedOn='2020-01-15'`             | `APPT_DATE=20200115` was formatted correctly                       |
| `081-24-12345` has no `unassignedOn`                     | `DISP_DATE=0` maps to null (active appointment)                    |
| `081-24-67890` has `unassignedOn='2021-06-30'`           | `DISP_DATE=20210630` was formatted correctly                       |
| No appointment for `081-23-99999`                        | `DELETE_CODE='D'` records are filtered by the gateway query        |
| `runtime-state` doc has `status='COMPLETED'`             | Migration ran to completion and persisted state                    |
| DLQ is empty                                             | No records failed processing                                       |

### `run-reset`

| Assertion                                                | What it verifies                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `runtime-state.status` returns to `COMPLETED`            | `{ reset: true }` flag bypasses the COMPLETED guard and triggers a re-run |
| Still exactly 2 `case-appointments` with `source='acms'` | Re-run is idempotent — duplicate-check prevents double-insertion          |

### `run-delete-all`

| Assertion                                               | What it verifies                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| 2 `case-appointments` with `source='acms'` re-created   | `deleteAll` purges acms records then re-runs the full migration   |
| 1 `case-appointment` with `source='dxtr'` still present | `deleteAll` only deletes `source='acms'` — DXTR data is untouched |
| Total case-appointments === 3                           | 2 acms + 1 dxtr                                                   |
| DLQ is empty                                            | No failures during the re-run                                     |

---

## 5. Cleanup instructions

**Remove test data only** (keep containers running):

```bash
cd test/integration
npm run migrate-case-appointments -- clean
```

**Stop and remove containers**:

```bash
cd test/integration/migrate-case-appointments/scripts
./stop-services.sh
```

`stop-services.sh` removes the pod and all three containers. Data is not persisted between runs —
the next `start-services.sh` starts fresh.

---

## Available commands

```
check-env       Verify required environment variables
seed-schema     [local] Create ACMS_INT database + apply CMMAP DDL
seed-sql        [local] Seed CMMAP fixture rows (idempotent — drop/recreate)
seed-cosmos     Seed TrusteeProfessionalId into MongoDB (upsert)
run             Full test: clean → seed → enqueue {} → wait → assert
run-reset       Verify { reset: true } bypasses COMPLETED state
run-delete-all  Verify deleteAll scopes deletion to source=acms only
clean           Remove test documents from MongoDB and clear queues
help            Show usage
```
