# trustee-verification-remap — Integration Test Harness (CAMS-894 / GitHub #2943)

One-shot TypeScript harness that exercises the `trustee-match-verification-remap` dataflow
end-to-end against real local containers — MongoDB (Cosmos stand-in), Azurite (Azure Storage Queues
stand-in), and the real dataflows function app.

Built to prove out the fix for CAMS-894: approving a trustee match in Data Verification reports
success synchronously, but the actual `CaseAppointment` write happens later in this async remap
dataflow. On staging, that write silently never landed for several cases. The root cause —
`TrusteeCaseAppointmentsMongoRepository.delete()` throwing a 404 when a surrogate's case-partition
copy is already missing, before the trustee-partition copy is deleted — is exactly what
`run-divergence` below reproduces.

---

## 1. Containers and why each is needed

| Container                                   | Image                                            | Port        | Purpose                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `cams-mongodb-trustee-verification-remap`   | `mongo:7.0`                                      | 27017       | Cosmos DB stand-in for `case-trustee-appointments`, `trustee-case-appointments`, `trustee-match-verification`, `trustee-variation` |
| `cams-azurite-trustee-verification-remap`   | `mcr.microsoft.com/azure-storage/azurite:latest` | 10000–10002 | Azure Storage emulator for the `trustee-match-verification-remap` queue trigger and its DLQ                                        |
| `cams-dataflows-trustee-verification-remap` | built from `Dockerfile.dataflows`                | 7072        | The real dataflows function app, unmodified                                                                                        |

All three run in the Podman pod `cams-trustee-verification-remap-pod` for shared localhost
networking. No SQL Edge container — the remap dataflow itself needs no DXTR/ACMS SQL access.

---

## 2. Prerequisites

- **Podman** installed and running (`podman info` should succeed)
- **Node.js** 20+ with `npx tsx` available (root `node_modules` installed)

---

## 3. Quick-start sequence

```bash
# 1. Configure the harness environment
cd test/integration/trustee-verification-remap
cp local.settings.integration.json.template local.settings.integration.json
cp .env.local.template .env.local

# 2. Start containers (builds the dataflows image on first run)
cd scripts
./start-services.sh

# 3. Run the full happy-path test
cd ../..
npm run trustee-verification-remap -- run

# 4. Run the CAMS-894 regression test — expected to FAIL until delete() is idempotent
npm run trustee-verification-remap -- run-divergence

# 5. (Optional) Exercise the requeue-and-re-query pagination path
npm run trustee-verification-remap -- run-pagination

# 6. (Optional) Verify replay idempotency
npm run trustee-verification-remap -- run-replay

# 7. Clean up test data
npm run trustee-verification-remap -- clean

# 8. Stop containers
cd trustee-verification-remap/scripts
./stop-services.sh
```

For faster dev-loop iteration on the function app itself (avoids a full Docker rebuild per change),
stop just the dataflows container after `start-services.sh` and use `start-funcapp.sh` to run it
directly on the host against the same MongoDB/Azurite containers:

```bash
podman stop cams-dataflows-trustee-verification-remap
cd scripts && ./start-funcapp.sh
```

---

## 4. What each command verifies

### `run` (happy path, multi-case)

One fingerprint spanning 4 cases — mirrors the staging report of several affected cases per approved
match.

| Assertion                                                       | What it verifies                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| All 4 surrogates drained from both partitions                   | `getSurrogatesByFingerprint` found them and `remapPage` processed them |
| Resolved trustee active in `case-trustee-appointments` per case | The case detail UI's read path (`getActiveByCaseId`) sees the fix      |
| Resolved trustee active in `trustee-case-appointments` per case | Dual-write completed on both partitions                                |
| `trustee-match-verification` doc is `status: 'approved'`        | `approveVerification` persisted correctly                              |
| `affectedCaseIds` snapshot matches all 4 seeded cases           | The pre-remap case-ID snapshot in `approveVerification` is correct     |
| DLQ is empty                                                    | No messages were dead-lettered                                         |

### `run-pagination`

Seeds `REMAP_PAGE_SIZE + 5` (30) surrogates sharing one fingerprint — forces at least one
requeue-and-re-query continuation, the multi-invocation path that only ever ran against mocks before
this harness.

### `run-divergence` — the CAMS-894 regression test

Seeds one surrogate via the real `upsert()` (so both partitions start with the same `id`, exactly as
production creates it), then removes **only** the case-partition copy directly, simulating a
dual-write divergence from an earlier partial failure. Approves the match and waits for the
surrogate to be removed from `trustee-case-appointments`.

**Before the fix**: this times out. `delete()` 404s on the missing case-partition copy and never
reaches the trustee-partition delete, reproducing the exact staging log entry
("`Matched and deleted 0 items`", module `TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY_ADAPTER`).

**After the fix**: `delete()` tolerates the missing partition copy and the trustee-partition
surrogate is removed, un-sticking the case.

### `run-replay`

Delivers the same remap message a second time after the first delivery has fully drained. Asserts
exactly one appointment per partition per case (no duplicates) and an empty DLQ — the
natural-idempotency claim in `remapPage`'s doc comment, proven against real Cosmos `upsert`
semantics.

---

## 5. Cleanup instructions

**Remove test data only** (keep containers running):

```bash
cd test/integration
npm run trustee-verification-remap -- clean
```

**Stop and remove containers**:

```bash
cd test/integration/trustee-verification-remap/scripts
./stop-services.sh
```

Data is not persisted between runs — the next `start-services.sh` starts fresh.

---

## Available commands

```
check-env        Verify required environment variables
run              Happy path: one fingerprint across 4 cases
run-pagination   Seed 30 surrogates (> REMAP_PAGE_SIZE) to exercise requeue
run-divergence   Regression test for CAMS-894 — expected to FAIL until fixed
run-replay       Deliver the same message twice; asserts no duplicates
clean            Remove all fixtures and clear queues
help             Show usage
```
