# sync-acms-professional-ids — Integration Smoke Test Harness

One-shot TypeScript harness that exercises the `sync-acms-professional-ids` dataflow end-to-end
against real local containers.

---

## 1. Containers and why each is needed

| Container                                   | Image                                            | Port        | Purpose                                                                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cams-mongodb-sync-acms-professional-ids`   | `mongo:7.0`                                      | 27017       | Cosmos DB stand-in for `trustees`, `trustee-variation`, `trustee-professional-ids`, and `runtime-state` collections                                                              |
| `cams-sqledge-sync-acms-professional-ids`   | `mcr.microsoft.com/azure-sql-edge:latest`        | 1433        | ACMS source (`ACMS_INT`: `CMMPR`/`CMMAP`/`CMMDB`) and DXTR source (`DXTR_INT`: `AO_CS_DIV`/`AO_OFFICE`/`AO_COURT`/`AO_GRP_DES`/`AO_REGION`) — two databases on the same instance |
| `cams-azurite-sync-acms-professional-ids`   | `mcr.microsoft.com/azure-storage/azurite:latest` | 10000–10002 | Azure Storage emulator for the `sync-acms-professional-ids-start`/`-page`/`-dlq` queues                                                                                          |
| `cams-dataflows-sync-acms-professional-ids` | built from `Dockerfile.dataflows`                | 7072        | The dataflows function app itself, running the real `handleStart`/`handlePage` triggers                                                                                          |

Unlike some other harnesses, the dataflows function app runs as a **container** (not a separately
started `npm start` process) — `start-services.sh` builds and starts it alongside the other three.
All four run in the Podman pod `cams-sync-acms-professional-ids-pod` for shared localhost
networking.

---

## 2. Prerequisites

- **Podman** installed and running (`podman info` should succeed)
- **Node.js** 20+ with `npx tsx` available (root `node_modules` installed)
- `backend/.env` present (used as the base env for both local and azure runs — see below)

### Environment sourcing

This harness does **not** use a harness-local `.env.local` file. Instead:

- `backend/.env` is always loaded first (matches the rest of the codebase's convention).
- For **local** runs, the harness overrides `MONGO_CONNECTION_STRING`, `COSMOS_DATABASE_NAME`,
  `ACMS_MSSQL_*`, `MSSQL_*` (DXTR), and `AzureWebJobsStorage` in code to point at the local
  containers instead of `backend/.env`'s real Azure lower-env values. The only local-only secret
  needed is the SQL Edge SA password, read from `scripts/.env` (same file `start-services.sh` uses).
- For **azure** runs (`INTEGRATION_ENV=azure`), `backend/.env`'s real values are used as-is — no
  overrides.

---

## 3. Quick-start sequence

```bash
# 1. Configure the SQL Edge SA password
cd test/integration/sync-acms-professional-ids/scripts
cp .env.template .env
# Edit .env and set MSSQL_PASS to a strong password

# 2. Start containers (builds the dataflows image and starts all four containers)
./start-services.sh

# 3. Create ACMS_INT + DXTR_INT databases and apply schema
cd test/integration
npm run sync-acms-professional-ids -- seed-schema

# 4. Seed CMMPR/CMMAP/CMMDB (ACMS_INT) and offices (DXTR_INT) fixture rows
npm run sync-acms-professional-ids -- seed-sql

# 5. Seed MongoDB fixtures (TRUSTEE_VARIATION + trustee profiles)
npm run sync-acms-professional-ids -- seed-cosmos

# 6. Run the full happy-path test
npm run sync-acms-professional-ids -- run

# 7. (Optional) Run the purge test
npm run sync-acms-professional-ids -- run-purge

# 8. Clean up test data
npm run sync-acms-professional-ids -- clean

# 9. Stop containers
cd test/integration/sync-acms-professional-ids/scripts
./stop-services.sh
```

---

## 4. What each assertion verifies

### `run` (happy path)

| Assertion                                                                                           | What it verifies                                                                                               |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `NY-00063` linked to `INTEGRATION-TRUSTEE-FINGERPRINT`                                              | Demographic-fingerprint matching auto-links a CMMPR record to its CAMS trustee via `TRUSTEE_VARIATION`         |
| `NY-00064` linked to `INTEGRATION-TRUSTEE-NAME`                                                     | A fingerprint miss falls through to fuzzy name matching and auto-links                                         |
| `NY-00065` has an errored `trustee-professional-ids` record with `error.disposition === 'no-match'` | No match + an active CMMAP appointment → an errored record (keyed by fingerprint) is written for later healing |
| `NY-00065`'s errored record has a non-empty `variant`                                               | The raw demographic variant is persisted on the record, not re-queried later                                   |
| `NY-00066` has no record at all                                                                     | No match + zero active appointments → silently skipped (no review noise)                                       |
| `UT-00070` linked to `INTEGRATION-TRUSTEE-UT`                                                       | A second `GROUP_DESIGNATOR` is paged and processed independently of `NY`                                       |
| `NY-00067` (deleted) and `NY-00068` (non-trustee) are never synced                                  | `DELETE_CODE='D'` and non-`'TR'` `PROF_TYPE` rows are filtered by the ACMS gateway query                       |
| `runtime-state` bookmark reaches `NY >= 66` and `UT >= 70`                                          | Per-group cursor tracking advances correctly across the full CMMPR fixture set                                 |

### `run-purge`

| Assertion                                                     | What it verifies                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Runs the happy path first, then re-enqueues `{ purge: true }` | A `purge` StartMessage flag is honored on a subsequent run, not just the first                                            |
| The same 3 professional-id links reappear after the purge     | `deleteAll` wipes `trustee-professional-ids` entirely, then the full CMMPR set reloads from scratch (not stale survivors) |

---

## 5. Cleanup instructions

**Remove test data only** (keep containers running):

```bash
cd test/integration
npm run sync-acms-professional-ids -- clean
```

**Stop and remove containers**:

```bash
cd test/integration/sync-acms-professional-ids/scripts
./stop-services.sh
```

`stop-services.sh` removes the pod and all four containers. Data is not persisted between runs — the
next `start-services.sh` starts fresh.

---

## 6. Notes on fixture data

- `GROUP_DESIGNATOR='UT'` in the CMMPR/DXTR fixtures is the real ACMS/DXTR designator for the Utica,
  NY division — **not** Utah (Utah's real designator is `SK`). It is reused here purely as a second,
  distinct group designator to prove per-group paging and bookmarking; no attempt is made to also
  model real Utah data.
- The `NY` and `UT` DXTR office rows (`AO_CS_DIV`/`AO_OFFICE`/`AO_COURT`/`AO_GRP_DES`/`AO_REGION`)
  use real reference data so that `getGroupDesignators()`'s live 5-table DXTR join is exercised
  faithfully, not mocked.

---

## Available commands

```
check-env    Verify required environment variables
seed-schema  [local] Create ACMS_INT + DXTR_INT, apply CMMPR/CMMAP/CMMDB + offices DDL
seed-sql     [local] Seed fixture rows (idempotent — drop/recreate)
seed-cosmos  Seed TRUSTEE_VARIATION + trustee profiles into MongoDB (upsert)
run          Full test: clean → seed → enqueue {} → wait → assert
run-purge    Verify { purge: true } wipes trustee-professional-ids and reloads from scratch
clean        Remove test documents from MongoDB and clear queues
help         Show usage
```
