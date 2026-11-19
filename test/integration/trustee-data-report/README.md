# trustee-data-report — Integration Harness

Runs the trustee data report (CAMS-977) end to end on real local infrastructure and checks what each
run stores. Every scenario has a stated expected result, so the table below is also the behavior
spec later slices build on.

A run is started through the real start use case (`startTrusteeDataReport`), which claims the run
lock and enqueues the start message. The real dataflows function app then pages through TOD and
finalizes the run. Nothing is stubbed: not the queues, the lock, or the run document. Assertions
read the `trustee-data-report` collection, not logs.

Manual dev tooling, not run in CI.

## 1. Containers

| Container                            | Image                                            | Port        | Purpose                                                                |
| ------------------------------------ | ------------------------------------------------ | ----------- | ---------------------------------------------------------------------- |
| `cams-mongodb-trustee-data-report`   | `mongo:7.0`                                      | 27017       | Cosmos stand-in: `trustees`, `trustee-data-report`, `runtime-state`    |
| `cams-sqledge-trustee-data-report`   | `mcr.microsoft.com/azure-sql-edge:latest`        | 1433        | TOD (`ATS_INT`: `TRUSTEES`, `CHAPTER_DETAILS`)                         |
| `cams-azurite-trustee-data-report`   | `mcr.microsoft.com/azure-storage/azurite:3.21.0` | 10000–10002 | `trustee-data-report-start`, `-page` and `-dlq` queues                 |
| `cams-dataflows-trustee-data-report` | built from `Dockerfile.dataflows`                | 7072        | The dataflows function app running the real `handleStart`/`handlePage` |

All four run in the Podman pod `cams-trustee-data-report-pod`.

**Local only.** The report reads every TOD trustee and every CAMS trustee, so its counts are only
predictable against databases holding nothing but these fixtures. Seeding replaces every TOD row,
and the harness checks that CAMS holds no other trustees before running. A shared lower-environment
database does not qualify, so there is no Azure mode.

## 2. Prerequisites

- Podman installed and running (`podman info` succeeds).
- Node.js matching `.nvmrc`, with the root `node_modules` installed (`npm ci` at the repo root).
- `backend/.env` present. The harness loads it, then points Mongo, TOD and storage at the local
  containers. The only local secret is the SQL Edge password in `scripts/.env`.

## 3. Quick start

```bash
cd test/integration/trustee-data-report
cp local.settings.integration.json.template local.settings.integration.json
cp scripts/.env.template scripts/.env
# The template password is the same in both files. To change it, change MSSQL_PASS in
# scripts/.env and ATS_MSSQL_PASS in local.settings.integration.json together.

cd scripts && ./start-services.sh        # builds the dataflows image, starts the pod

cd ../.. && npm run trustee-data-report -- run   # clean, seed, run every check, print the table

cd trustee-data-report/scripts && ./stop-services.sh
```

`run` exits non-zero on a failure, or when a known gap starts passing (update the table and
`KNOWN_GAPS` in the harness). A known gap that still fails the documented way (`knownGapActual` in
the fixtures) does not fail the run; one that fails any other way does.

## 4. Commands

```
check-env    Verify the environment the harness and the start use case need
seed-schema  Create ATS_INT and the TRUSTEES/CHAPTER_DETAILS tables
seed-sql     Replace all TOD rows with the fixtures
seed-cosmos  Replace the fixture CAMS trustees and create the bicep-declared indexes
run          clean, seed, then run every scenario and lifecycle check
clean        Remove report results, fixture trustees and the run lock; clear the queues
```

## 5. Scenarios

TOD rows are in `seed/01-seed-trustees.sql` and `seed/02-seed-chapter-details.sql`; CAMS trustees
and expected results in `scripts/trustee-data-report-fixtures.ts`. The report reads TOD 100 trustees
per page; 100 filler rows (`seed/03-seed-filler.sql`) push TOD IDs 500–505 onto page 2 so S26, S27
and S42 are merged across pages, and S46 and S47 write their results from page 2.

Each scenario asserts the exact set of difference rows the run records for it: none, or the listed
ones with their values.

| ID  | Given                                                                             | Then                                                                        | Status                    |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------- |
| S01 | A linked trustee identical to TOD                                                 | Nothing reported                                                            | Pass                      |
| S02 | Padded and double-spaced values, phone punctuation, email case                    | Nothing reported                                                            | Pass                      |
| S03 | TOD has address line 2 and a separate `ZIP_PLUS`                                  | Nothing reported when CAMS has the same                                     | Pass                      |
| S04 | TOD ZIP has a leading zero, with a `ZIP_PLUS`                                     | Nothing reported when CAMS has `02108-0001`                                 | Pass                      |
| S05 | Only `DISP_ON_WEB_A2` is `y`                                                      | The A2 address is compared as public, the other as internal                 | Pass                      |
| S06 | Both display flags are `y`                                                        | The first address stays public                                              | Pass                      |
| S07 | TOD record has no person name; CAMS has a real name                               | A `name` difference against "Unknown"                                       | Pass                      |
| S08 | Middle initial, and a suffix inside `LAST_NAME`                                   | Nothing reported                                                            | Pass                      |
| S09 | Empty-string TOD columns                                                          | Nothing reported against absent CAMS fields                                 | Pass                      |
| S10 | TOD phone `503-555-0119 204`; CAMS phone `503-555-0119`, extension `204`          | Nothing reported                                                            | Known gap                 |
| S11 | Eleven-digit TOD phone with a country code                                        | Nothing reported                                                            | Pass                      |
| S12 | Name differs                                                                      | One `name` difference with both values                                      | Pass                      |
| S13 | Company name differs                                                              | One `companyName` difference                                                | Pass                      |
| S14 | Public address differs                                                            | One `publicAddress` difference                                              | Pass                      |
| S15 | Internal address differs                                                          | One `internalAddress` difference                                            | Pass                      |
| S16 | Phone differs                                                                     | One `phone` difference                                                      | Pass                      |
| S17 | Email differs                                                                     | One `email` difference                                                      | Pass                      |
| S18 | Linked to one existing and one missing TOD ID                                     | Compared against the existing one; not CAMS only                            | Pass                      |
| S19 | Linked TOD trustee has only inactive appointments                                 | Still compared                                                              | Pass                      |
| S20 | Unlinked TOD trustee with one active and one resigned appointment                 | TOD only                                                                    | Pass                      |
| S21 | Unlinked TOD trustee with only resigned appointments                              | Not reported                                                                | Pass                      |
| S22 | Unlinked TOD trustee with no appointment rows                                     | Not reported                                                                | Pass                      |
| S23 | The same person twice in TOD, neither record linked                               | TOD only, once per record                                                   | Pass                      |
| S24 | An unlinked TOD record for a person CAMS links to a different TOD record          | The unlinked record is TOD only; the linked one matches                     | Pass                      |
| S25 | Unlinked TOD trustee active through a converted-case (`O`) appointment            | TOD only                                                                    | Pass                      |
| S26 | Merged trustee, TOD records on pages 1 and 2, CAMS holds the most complete record | Nothing reported; compared once                                             | Pass                      |
| S27 | Merged trustee across pages, CAMS holds the less complete record                  | `publicAddress` difference against the most complete record (caveat)        | Pass                      |
| S28 | Merged trustee, both records on page 1, CAMS holds the more complete record       | Nothing reported                                                            | Pass                      |
| S29 | CAMS-native trustee with no TOD IDs                                               | CAMS only                                                                   | Pass                      |
| S30 | CAMS trustee whose only TOD ID no longer exists                                   | CAMS only                                                                   | Pass                      |
| S31 | CAMS trustee whose only TOD ID is not a number (none in CAMS today)               | CAMS only                                                                   | Pass                      |
| S34 | Both display flags `N` (the most common combination)                              | The first address is public, A2 internal                                    | Pass                      |
| S35 | `DISP_ON_WEB` missing, `DISP_ON_WEB_A2` `Y`                                       | The A2 address is public                                                    | Pass                      |
| S36 | TOD trustee with no address at all                                                | Nothing reported against the empty CAMS address                             | Pass                      |
| S37 | The public address has no state; the A2 address does                              | The public state comes from A2                                              | Pass                      |
| S38 | `ZIP_PLUS` is not four digits                                                     | It is dropped; nothing reported against a five-digit CAMS ZIP               | Pass                      |
| S39 | TOD phone has punctuation and no digits                                           | Nothing reported against a CAMS trustee with no phone                       | Pass                      |
| S40 | Unlinked TOD trustee whose only status is inactive chapter 11 (`9`)               | Not reported                                                                | Pass                      |
| S43 | Unlinked TOD trustee active through chapter 13 standing (`1`)                     | TOD only                                                                    | Pass                      |
| S44 | Unlinked TOD trustee active through chapter 12 case-by-case (`2`)                 | TOD only                                                                    | Known gap                 |
| S41 | Unlinked TOD trustee whose only status is empty                                   | TOD only, flagged for review                                                | Known gap                 |
| S42 | Merged from three TOD records, two on page 2; CAMS holds the most complete        | Nothing reported                                                            | Pass                      |
| S46 | Unlinked active TOD trustee on page 2 only                                        | TOD only                                                                    | Pass                      |
| S47 | Trustee linked to one TOD record on page 2 only; email differs                    | One `email` difference                                                      | Pass                      |
| S32 | Filler TOD trustees, and anything outside the scenarios                           | Nothing reported                                                            | Pass                      |
| S33 | The whole run                                                                     | Compared and CAMS-only counts add up to the scenarios                       | Pass                      |
| S45 | The whole run                                                                     | TOD-only and field-difference counts add up to the scenarios                | Known gap (S10, S41, S44) |
| L1  | A run started through the start use case                                          | Completes on real infrastructure                                            | Pass                      |
| L2  | A run completes                                                                   | The lock is released                                                        | Pass                      |
| L3  | A second start while a run is active                                              | Refused with 409                                                            | Pass                      |
| L4  | A second run completes                                                            | The first run and all of its rows are removed                               | Pass                      |
| L5  | A run cannot read TOD (the `TRUSTEES` table is renamed for the run)               | Fails with "Could not read from TOD…"; previous results kept; lock released | Pass                      |
| L6  | The lock is older than 2 hours                                                    | A start takes it over, marks that run failed, and completes                 | Pass                      |
| L7  | A page message is delivered again after the run completed                         | Dead-lettered; results and summary unchanged                                | Pass                      |

### Known gaps and caveats

- **S10, phone extension (known gap, latent).** No CAMS trustee has a separate extension today (CAMS
  profile: 0), so this cannot happen yet. TOD has no extension field. ATS_SUB has no `x` or `ext`
  markers, but 11 phones have 12 or 13 digits, which looks like extension digits after the number
  (`503-555-0119 204`). The migration copies such a phone as-is. CAMS stores an extension in its own
  field, and the comparison reads only `phone.number` and compares digits, so once a trustee's
  number and extension are stored separately the same phone is reported as a `phone` difference.
- **S44, chapter 12 case-by-case status `2` (known gap).** Active, per the product owner
  (2026-11-18), as the migration treats it (`CBC_STATUS_MAP`). The matrix lists "1 or 2" as active
  for chapter 12 case-by-case. The report decides "active" from `ACTIVE_STATUS_CODES`, which is
  built from `TOD_STATUS_MAP` alone and ignores the chapter, so an unlinked trustee active only
  through `2` is never TOD only. ATS_SUB has 3 such appointment rows. The migration's default page
  filter uses the same set.
- **S41, empty status (known gap).** The product owner (2026-11-18) wants an unlinked TOD trustee
  whose only status is empty flagged for review, so it should be reported as TOD only. The report
  treats an empty status as inactive and omits it. ATS_SUB has 10 such appointment rows.
- **S45 (known gap).** Follows from S10, S41 and S44: one false phone difference and two missing
  TOD-only trustees.
- **S27 (caveat, passing).** The migration read TOD 50 trustees at a time, so a trustee merged from
  records on different migration pages can hold a record that is not the most complete one. The
  report compares against the most complete record and reports the difference. This is the behavior
  today, pinned so a change is deliberate.
- **S07 and S29 (product decisions, passing).** Confirmed by the product owner (2026-11-18): a
  linked TOD record with no name (3 in ATS_SUB) is compared as "Unknown" and flagged with a `name`
  difference, and a CAMS-native trustee with no TOD IDs is reported as CAMS only.

The first run also caught a bug, since fixed: L5 showed "See the dataflows app's logs" instead of
"Could not read from TOD", because TOD's SQL client raises errors under the module
`ABSTRACT-MSSQL-CLIENT (ATS-GATEWAY)`, not `ATS-GATEWAY`.

## 6. Profiling real data

`profiling/ats-sub-patterns.sql` (TOD) and `profiling/cams-trustees-patterns.js` (CAMS, mongosh)
count the data patterns these fixtures stand in for. They return counts and code values only, never
names or contact details. Run them read-only where the real databases are reachable, and add a
scenario for any pattern the fixtures do not cover. Both were checked against these fixtures.

## 7. Not covered

- **Redelivery of a page while its run is in progress.** Sequential redelivery is idempotent by
  design (a page replaces its own rows) and the use-case tests cover it; timing a duplicate into a
  live run is not deterministic here.
- **TOD unreachable.** Timeouts are retried for about 75 minutes before the run fails, too long for
  this harness. L5 covers the failure path with a query error instead.

## 8. Keeping in step

- Indexes are created in `seed-cosmos` to match `trusteeDataReportCollection` and the trustees
  single-field `legacy.truIds` index in
  `ops/cloud-deployment/lib/cosmos/mongo/cosmos-collections.bicep`. Change both together.
- The TOD DDL holds only the columns the report reads (`TRUSTEE_COLUMNS` in `ats.gateway.ts`).
- Fixtures are synthetic: invented names, `555-01xx` phones, `example.com`/`.org` emails. Do not add
  rows copied from TOD or CAMS.
