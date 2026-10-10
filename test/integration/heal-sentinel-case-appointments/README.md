# heal-sentinel-case-appointments — Local End-to-End Harness

Runs the real `heal-sentinel-case-appointments` dataflow (`handleStart` and `handlePage` in
`backend/function-apps/dataflows/heal-sentinel-case-appointments.ts`) inside a real Azure Functions
host against local MongoDB and Azurite, seeded with invented fixtures, and asserts the resulting
Mongo state. It is separate from `../heal-sentinel-case-appointments-audit/`, which audits data
rather than running the dataflow.

## Containers

All three run in the Podman pod `cams-heal-sentinel-case-appointments-pod`. Inside the pod each
service listens on its default port; the host-side ports below are chosen so this pod can run next
to `cams-sync-acms-professional-ids-pod` and the `cams-local-infra-*` containers.

| Container                                        | Image                                            | Host port (env override)                                                                      |
| ------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `cams-mongodb-heal-sentinel-case-appointments`   | `mongo:7.0`                                      | 27317 (`HEAL_MONGO_PORT`)                                                                     |
| `cams-azurite-heal-sentinel-case-appointments`   | `mcr.microsoft.com/azure-storage/azurite:3.21.0` | 10300 blob, 10301 queue, 10302 table (`HEAL_AZURITE_BLOB_PORT`, `_QUEUE_PORT`, `_TABLE_PORT`) |
| `cams-dataflows-heal-sentinel-case-appointments` | built from `Dockerfile.dataflows`                | 7372 (`HEAL_DATAFLOWS_PORT`)                                                                  |

There is no SQL Edge container: this dataflow touches only MongoDB and its storage queues, and the
host starts without SQL Server.

The image copies the current `backend/` and `common/` working tree, so uncommitted changes are what
runs; `start-services.sh` rebuilds it every time. Two settings keep the host isolated:

- `Dockerfile.dataflows.dockerignore` (passed with `--ignorefile`) keeps every `.env` and
  `local.settings.json` out of the image. The host calls `dotenv.config()`, so a copied `.env` would
  supply any variable `local.settings.integration.json` leaves unset, including real
  lower-environment SQL and Okta settings.
- `local.settings.integration.json` disables every default-enabled function except the two
  `HEAL-SENTINEL-CASE-APPOINTMENTS-*` triggers (`AzureWebJobs.<name>.Disabled`), so no timer fires
  during a run. If a new dataflow is added to `DEFAULT_DATAFLOWS` in
  `backend/function-apps/dataflows/dataflows.ts`, add its functions to that list.

## Running

```bash
cd test/integration/heal-sentinel-case-appointments/scripts
./start-services.sh

cd ../..        # test/integration
npm run heal-sentinel-case-appointments            # seed, then runs 1-3 with assertions
npm run heal-sentinel-case-appointments -- seed    # seed only, for poking at the data

cd heal-sentinel-case-appointments/scripts
./stop-services.sh
```

The harness drops and re-creates the `cams-heal-sentinels` database on every invocation, so it can
be re-run against the same pod. It exits non-zero if any assertion fails or if the queues do not
drain within `HEAL_TIMEOUT_MS` (default 10 minutes). `HEAL_SEED` (default 877) picks a different
deterministic fixture set.

## Fixtures

`scripts/heal-sentinel-fixtures.ts` synthesizes everything from a seeded PRNG. With the default
seed:

| Scenario             | Records | Sentinels | Expected outcome                                                                                     |
| -------------------- | ------: | --------: | ---------------------------------------------------------------------------------------------------- |
| `linked-heavy`       |       1 |      2500 | heals on run 1 across 3 full pages plus a final empty page                                           |
| `linked-medium`      |       3 |      2176 | heals on run 1                                                                                       |
| `linked-small`       |      40 |       203 | 1–20 each (skewed toward 1); heals on run 1                                                          |
| `linked-zero`        |       3 |         0 | flagged `sentinelsHealedOn` on run 1                                                                 |
| `pre-flagged`        |       1 |        37 | already has `sentinelsHealedOn`; untouched by run 1, heals on run 2                                  |
| `no-match`           |       4 |        69 | never paged, never heals                                                                             |
| `ambiguous`          |       3 |        30 | never paged, never heals                                                                             |
| `conflict-with-link` |       1 |         — | shares its ACMS ID with a `linked-small` record; that ID's sentinels heal to the linked trustee only |
| `conflict-orphan`    |       1 |         9 | conflict with no linked record for its ACMS ID; never heals                                          |
| `double-linked`      |       2 |        12 | one ACMS ID linked to two trustees; both pages stop at `link-changed`, nothing heals or is flagged   |

Every sentinel is written to both `case-trustee-appointments` and `trustee-case-appointments` with
the same `id`, `trusteeId` `SENTINEL_TRUSTEE_ID`, `reason: 'trustee-not-found'`, and its
`acmsProfessionalId`; about 30% are closed (some reopened) and some carry `unassignedOn`. Sentinels
are inserted shuffled across groups, so each record's `_id` cursor skips over other records' rows.
150 ordinary resolved appointments (some under linked trustees and carrying their
`acmsProfessionalId`) must stay byte-identical.

Indexes mirror production: `index-trustee-case-appointments.js` for `trustee-case-appointments`
(including `acmsProfessionalId_1`) and `cosmos-collections.bicep` for `case-trustee-appointments`
and `trustee-professional-ids` (including the unique
`camsTrusteeId`/`acmsProfessionalId`/`documentType` index). Update `createIndexes` in the harness
when either source changes.

### PII rule

Fixtures are invented only. Names are syllable combinations, phone numbers use the fictional
555-01xx range, emails use `example.test`, and ACMS professional IDs, CAMS trustee IDs, and case
numbers are generated. Never read from `data/` or any `fixtures/` directory, and never add a real
trustee name.

## Assertions

Run 1, `{}`:

- Each healable group has no sentinel left in either partition, and each of its cases has exactly
  one appointment per partition under the record's `camsTrusteeId`, with the same `id` in both,
  `reason` and `acmsProfessionalId` absent, and `assignedOn`, `appointedDate`, `dateFiled`,
  `chapter`, `courtDivisionCode`, `unassignedOn`, `closedDate`, `reopenedDate`, and `caseStatus`
  equal to the sentinel's.
- `sentinelsHealedOn` is set on exactly the linked, unflagged, single-link records; the pre-flagged
  record's value is unchanged; no other record gains one.
- Sentinels of every non-healing group and the pre-flagged group are byte-identical in both
  partitions; ordinary appointments are byte-identical; each partition's document count is
  unchanged; nothing is written under a non-linked record's `camsTrusteeId`.

Run 2, `{ ignoreSentinelsHealedOn: true }`: the pre-flagged group heals and is re-flagged with a
newer `sentinelsHealedOn`; no other appointment changes; double-linked records stay unflagged.

Run 3, `{}`: all three collections are byte-identical to their state after run 2.

Every run: the start, page, DLQ, and both poison queues are empty, and the number of `handlePage`
executions in the host log (`podman logs`) equals the expected count (one per non-empty page plus
one empty read per record; one per double-linked record), with none failed or retried.

## Not covered

- **429 throttling and gateway timeouts.** Local MongoDB never returns Cosmos request-rate errors,
  so the use case's backoff, the deadline escape, and `handlePage`'s jittered requeue are not
  exercised. Those paths are covered by unit tests in
  `backend/lib/use-cases/dataflows/heal-sentinel-case-appointments.test.ts` and
  `backend/function-apps/dataflows/heal-sentinel-case-appointments.test.ts`.
- **Cosmos query semantics and RU cost.** Shard keys are not enforced and indexes are plain MongoDB
  indexes; a pass here says nothing about RU consumption per page.
- **The one-hour page budget.** Pages finish in milliseconds locally.
- **Per-sentinel heal failures** (a sentinel left in place and its record left unflagged); no local
  fault injection exists for a single upsert or delete.
