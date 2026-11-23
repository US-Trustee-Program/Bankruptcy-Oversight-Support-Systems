# sync-trustee-case-appointments — Integration Harness

The grounding and truth for the ACMS- and DXTR-sourced trustee case appointment sync and its
interaction with the trustee-match pipeline. It runs BDD-style scenarios against **real** SQL Server
(SQL Edge) and MongoDB, **in-process**: `source.getEventsForDate` → `processAppointments` → assert
the CAMS state left in Mongo. No Azure Functions host, queues, Azurite or mocks.

Use it to guide development: a scenario that fails is a target, not a mistake. A scenario reports
`NOT IMPLEMENTED` only when a binding in `scripts/bindings.ts` cannot be resolved.

## What it checks

| Group      | What                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `query`    | ACMS fixtures through the **production** `AcmsGateway.getCmmapAppointmentsRaw` (filters, region, change date).                                                                |
| `scenario` | source → sync → CAMS state, per lane (`ACMS`, `DXTR`), many shared for source parity.                                                                                         |
| `driver`   | per-region bookmark, catch-up from 2026-07-01, run-date exclusion, named regions, per-region ACMS/DXTR source routing, operator delete by region and date range then replace. |

`npm run sync-trustee-case-appointments -- list` and the run summary print the current counts.

Each scenario is written once in [`scripts/scenarios.ts`](scripts/scenarios.ts), source-neutral, and
rendered into ACMS rows (CMMPR/CMMDB/CMMAP/CMMKE) and/or DXTR rows (AO_CS/AO_PY/AO_TX). Every
scenario carries a `basis` so a guess is never mistaken for a requirement:

- `feature` — a scenario of the same name in
  `test/bdd2/specs/CAMS-955-acms-case-appointment-sync.feature`
- `bead` — a requirement recorded in the issue tracker (summarized in `note`)
- `decision` — stated by a maintainer in review (summarized in `note`)
- `code` — read from production code, not a stated requirement
- `provisional` — a conceivable edge case with an unconfirmed expectation; confirm or correct it
  with the owners of the behavior

### Fixtures are segmented by region

The sync works per region (per-region bookmarks, per-region ACMS/DXTR source, per-region tasks), so
geography is a first-class part of the fixtures (`DIVISIONS` in `scenarios.ts`):

| Region | Group | Division | Court | Notes                                                                  |
| ------ | ----- | -------- | ----- | ---------------------------------------------------------------------- |
| 02     | NY    | 081      | 0208  | Manhattan (real codes)                                                 |
| 02     | UT    | 066      | 0206  | Utica NY (not Utah); gives region 02 two divisions                     |
| 03     | PA    | 301      | 0301  | synthetic                                                              |
| 04     | DA    | 401      | 0401  | synthetic                                                              |
| 04     | DB    | 402      | 0402  | synthetic; DXTR `CS_DIV` 492 differs from ACMS division 402 on purpose |

A case id's division prefix determines its region, group and court everywhere (CMMAP `REGION_CODE`,
DXTR `GRP_DES`, the `SYNCED_CASE` document, the identity task's `courtId`). Scenarios cover read
isolation across regions and change dates, the compound-key rule across regions, tasks carrying
their own region's court, the core identification/active-trustee/placeholder rules repeated in
regions 03 and 04, and driver scenarios for per-region bookmarks and a region switched to DXTR. One
driver scenario (`driver-two-regions-twice-no-duplicates`) runs a DXTR region and an ACMS region
together, twice, and asserts no-match/ambiguous identity tasks on both lanes plus no duplicate
appointments or tasks after the second run. Driver scenarios check appointments in both partitions
(`case-trustee-appointments` and `trustee-case-appointments`) and, when a scenario runs twice, after
each run.

**Bookmark rule (maintainer decision):** for both ACMS and DXTR, a date is complete only when a
later date exists, so the newest date is processed but never bookmarked. Every driver scenario gives
a region a row on a later date than the one it expects to be bookmarked.

### Fixtures are shaped like staging data

Shapes were profiled from retained staging exports (aggregates only; no real values are stored):
ACMS names are upper-case (the renderer upper-cases every ACMS text field, so every ACMS scenario
also proves case-insensitive matching), suffixes and decorations inside the last name, multi-word
and initial-only first names, 4% with no address and 3.5% with no city/state/zip, phone `0` for 14%,
ZIP+4 everywhere. DXTR variants vary generation, address line 2, phone punctuation, ZIP+4, email and
case. `DXTR_NAME_SHAPES` (basis `provisional`, since there is no staging DXTR export to confirm real
counts) covers first/middle swapped, a nickname, a suffix embedded in the last name, a hyphenated
surname where CAMS holds only one half, and trailing role text. All five link via the pipeline.
Every resolve stage requires a passing name check, so in each case the name passes after
normalization, and phone plus city/state/zip corroborate it. Street and email are identical only for
the swapped and nickname shapes: `person()` derives both from the last name, so they differ for the
other three. Jurisdiction scenarios span court, division, chapter (7, 11, 12, 13) and appointment
status (active, voluntarily-suspended, resigned) for the Trustee Appointment task. Seeded CAMS
trustees carry `phoneticTokens` and the `legacy` block, as real ones do, and the Mongo client uses
`ignoreUndefined` like production.

### ACMS-only scenarios (and why)

Every source-neutral matching/lifecycle scenario also runs on the DXTR lane. What's left ACMS-only,
and why (each scenario's own `note` says the same):

- **ACMS professional-id concepts with no DXTR equivalent** (DXTR carries no `acmsProfessionalId`
  because its copy of the ACMS professional code can be wrong):
  `professional-id-beats-name-mismatch`, `one-trustee-two-professional-ids`,
  `ambiguous-link-not-used`, `compound-professional-key`,
  `compound-professional-key-across-regions`. `known-by-professional-id` and the per-region
  `${tag}-known-by-professional-id` are the exception: they run on both lanes, since the DXTR row
  carrying the same group+code but resolving via the pipeline instead is exactly the `.feature`
  scenario "A DXTR professional code does not link a trustee."
- **ACMS-only fields**: DISP_DATE (`disp-date-closes-matching`, `reappointed-after-disposition`,
  `unknown-closed-removes-placeholder`, the per-region `${tag}-disp-date-closes-matching`), raw
  `CURR_CASE_CHAPT` (`invalid-chapter-goes-to-dlq-alone`, `chapter-7a-normalized`,
  `chapter-7n-normalized`), and `CLOSED_BY_COURT_DATE`/`CLOSED_BY_UST_DATE`/the CMMKE reopen key
  event (`closed-and-reopened-case-dates`, `closed-by-ust-only`, `closed-before-appointed`) —
  `toTrusteeAppointmentEvent` (DXTR gateway) never sets `closedDate`/`reopenedDate` at all.
- **`zero-appointment-date`**: DXTR always has an `appointedDate` (`toTrusteeAppointmentEvent` falls
  back to the NOT NULL `TX_DATE` whenever the REC-embedded date is blank or unparseable), so it
  can't reproduce the missing-`appointedDate` DLQ an ACMS `APPT_DATE` of 0 produces.
- **`source-filters`**: ACMS SQL-level read filters (`getCmmapAppointmentsRaw`); DXTR's own read
  filter (`REGION_TRUSTEE_APPOINTMENT_FILTER`) is a different query, not tested here.
- **`identity-tasks-carry-their-region`**: its two passes target different regions with different
  per-pass task shapes, which the scenario-level `dxtrExpect` (one flat override applied to every
  pass) can't express per pass. Not a coverage gap: the region-court-on-task fact is already proven
  by the per-region `${tag}-unknown-open-placeholder-and-task` scenarios and the
  `driver-two-regions-twice-no-duplicates` driver scenario.
- **`acms-name-shape-parenthetical-decoration`** (the one `NAME_VARIANTS` entry still
  ACMS-prefixed): `acmsLastSuffix` is purely an ACMS CMMPR last-name rendering quirk; DXTR's `AO_PY`
  has no decoration to append, so there's nothing DXTR-specific to test.

### Replaying real exports (aggregate output only)

```bash
F=../../../CAMS/test/integration/sync-acms-professional-ids-audit/fixtures   # gitignored over there
npm run sync-trustee-case-appointments -- replay \
  --professional-ids $F/2026-10-05-trustee-professional-ids.json \
  --trustees $F/2026-10-05-trustees.json --limit 500 --region 02
```

Seeds one synthetic case and CMMAP row per real professional (one synthetic division per real
group), loads the real CAMS trustees and links, verifies every row comes back through the production
ACMS query, and runs the sync and prints only counts: appointments by `matchedBy`, tasks by reason,
DLQ, and agreement with the export's own professional-id dispositions. It prints no names or
addresses.

- The real rows **are loaded into the local containers** and wiped when the command ends (they stay
  in the pod until then). `--verbose` is ignored by replay so production log lines, which can carry
  names, stay hidden.
- Replay seeds export documents verbatim, so it assumes the export's schema matches the current
  repository schema.
- **Never copy exports into this repo.** Keep them in the checkout where they are gitignored.
  (`fixtures/` and `data/` under this directory are ignored only as a safety net.)

## Backtest

`npm run sync-trustee-case-appointments -- backtest` is the deterministic backtest that gates the
first production DXTR region switch. The gate is procedural: nothing in the product checks that the
backtest ran or passed. It runs every scenario whose `lanes` include `DXTR`, on the DXTR lane only,
twice, each scenario on wiped databases. `--only` and `--region` filter as for `run`; `--lane` is
ignored. Driver scenarios are not part of it: region routing is covered by `run`.

- **Pass bar.** Each fixture's `Expect` is the bar. The backtest passes only when every DXTR fixture
  gets its declared outcome on both runs. There are no thresholds and no LLM grading.
- **Outcome table.** Expected (from each pass's `Expect`) vs actual (from Mongo and the run) counts
  for: linked, by method (`professional-id`, `variation`, or `pipeline` for any pipeline stage;
  "method not asserted" when the fixture names no method); placeholder appointment; identity task,
  by reason (or "reason not asserted"); identity tasks in total; skipped (the pass asserts the
  source returned events and nothing was written: no appointment, task, parked record or DLQ);
  parked; dead-lettered. Only what an `Expect` asserts is counted, so both columns cover the same
  scope. A row marked `✗` disagrees; the scenario's own `✗` lines say why.
- **Determinism.** After each scenario the harness hashes every harness Mongo collection (sha256 of
  documents with sorted keys; `_id`, `id`, `createdOn`/`updatedOn`/`createdBy`/`updatedBy` dropped;
  generated uuids, ObjectIds and wall-clock (non-midnight) ISO timestamps replaced by placeholders).
  Any scenario whose hash differs between run 1 and run 2 fails the backtest, as does any difference
  in the outcome counts. Scope: both runs execute in the same process, and every uuid becomes the
  same placeholder, so the digest compares document content, not which document a reference points
  at. The fixtures' own assertions check trustee identity.
- **Nothing selected.** If `--only` or `--region` matches no DXTR-lane scenario, the backtest runs
  nothing and exits `1` instead of reporting a vacuous pass. `run` does the same.
- **Exit codes:** `0` passed, `1` a fixture failed, the runs differ or nothing was selected, `3` and
  `4` as for `run`.

## The seams

[`scripts/bindings.ts`](scripts/bindings.ts) is the only file that binds to production modules by
name or assumes a persisted shape:

1. `getAcmsSource()` — expects `AcmsTrusteeAppointmentSource` exported from
   `backend/lib/use-cases/dataflows/trustee-appointment-source.ts`, no-arg constructor.
2. `runRegionDriver()` — the per-region driver, including source routing. The contract is
   `{ regions, runDate }`. Adapt the binding to the driver's API, not the harness.
3. `seedRegionState()` / `readRegionBookmark()` — the per-region runtime-state document the driver
   reads and writes: `region.<id>.lastSyncDate` and `region.<id>.source = { system: 'DXTR', ... }`
   (`TrusteeAppointmentRegionSyncState` in `gateways.types.ts`).

If a production API changes, adapt these functions; nothing else changes.

## Prerequisites

- Podman (`podman info` works), Node per `.nvmrc`, root `npm ci` done.
- Ground-truth fixture DDL for ACMS is in `seed/00-seed-acms-schema.sql`. It is derived from
  `getCmmapAppointmentsRaw` and the ACMS data dictionary: **`CMMAP.PROF_CODE` joins
  `CMMPR.UST_PROF_CODE`** (both with `GROUP_DESIGNATOR`). CMMAP has no `UST_PROF_CODE` column,
  despite documentation elsewhere that implies otherwise.
- DXTR note: `UT` is the real group designator for Utica, NY, not Utah.

## Run

```bash
cd test/integration/sync-trustee-case-appointments
cp scripts/.env.template scripts/.env           # set MSSQL_PASS (SQL Edge SA password)
cp .env.local.template .env.local               # same password for ACMS_MSSQL_PASS and MSSQL_PASS
scripts/start-services.sh                       # MongoDB + SQL Edge on 127.0.0.1 (ACMS_INT and DXTR_INT)

cd ..                                           # test/integration
npm run sync-trustee-case-appointments -- check-env
npm run sync-trustee-case-appointments -- seed-schema
npm run sync-trustee-case-appointments -- run
npm run sync-trustee-case-appointments -- run --lane DXTR     # or ACMS
npm run sync-trustee-case-appointments -- run --region 03
npm run sync-trustee-case-appointments -- run --only known-by-variation
npm run sync-trustee-case-appointments -- run --only driver-delete-region-date-range-replaces   # a driver scenario
npm run sync-trustee-case-appointments -- run --verbose       # show production log lines
npm run sync-trustee-case-appointments -- backtest              # DXTR fixtures twice, against their declared outcomes
npm run sync-trustee-case-appointments -- clean

cd sync-trustee-case-appointments && scripts/stop-services.sh
```

**Safety.** The harness wipes its databases between scenarios, so it refuses to run any command that
writes (`seed-schema`, `run`, `replay`, `clean`) unless the Mongo host, `ACMS_MSSQL_HOST` and
`MSSQL_HOST` are `localhost`/`127.0.0.1` and `COSMOS_DATABASE_NAME` contains `-idxtest-` (the same
convention as `../_lib/ephemeral-cosmos-database.ts`). It exits 4 when it refuses.

**Exit codes:** `0` all pass, `1` at least one failure (a regression, an unmet expectation or
infrastructure trouble) or nothing matched `--only`/`--region`/`--lane`, `2` no failures but some
scenarios are `NOT IMPLEMENTED` (targets), `3` a database is unreachable (preflight), `4` refused by
the local-only guard.

`.env.local` can be assembled from the sibling `../CAMS` checkout's `test/integration/*/.env.local`
(Mongo + ACMS from `migrate-case-appointments`, DXTR from `trustee-match-scenarios`). The two used
different SA passwords; this harness runs one SQL Edge instance, so set both passwords to the value
in `scripts/.env`, and change `COSMOS_DATABASE_NAME` to one containing `-idxtest-`. The container
images are pinned (`mongo:7.0.37`, `azure-sql-edge:1.0.7`).

## Design decisions

- **Duplication over reuse.** Nothing here imports from another harness, and no shared lib is used.
  Deleting a harness directory is the entire removal.
- **Variations and pending tasks are derived from the event the source actually returns**
  (`buildVariant`/`computeFingerprint` on the real event), so the harness never assumes how a source
  formats a trustee.
- **A skip is only proven if the read is.** A pass that expects nothing written must also declare
  `sourceEvents`, otherwise "nothing written" cannot be told from "the source never returned the
  row". `tasksTotal` counts tasks under any name.
- **DXTR is read one region and one `TX_DATE` day at a time** (`DxtrTrusteeAppointmentSource`, paged
  by `TX_ID`), the same unit as ACMS, so the harness asks for each change date directly.
- **Dual-partition check.** Every appointment assertion also checks that `case-trustee-appointments`
  and `trustee-case-appointments` agree. Seeded appointments share one `id` across both, as
  production writes them.

## Open finding

- **Ambiguous professional-id link.** A tracker requirement says 2+ links is an integrity error that
  goes straight to a "multiple linked trustees" task; the `.feature` says it falls through to
  variation and the pipeline. Scenario `ambiguous-link-not-used` follows the `.feature`.

## Not covered (and why)

- A transient error retries in place — needs fault injection into Cosmos; covered by unit tests.
- A long date continues in a fresh message — needs an invocation budget the harness can shrink. The
  driver accepts `startedAt` and `safeThresholdMs`, but `runRegionDriver` in `bindings.ts` does not
  pass them through.
- Lane assignment, the Case Appointments admin page, the Trustee Appointment task documents and the
  gap report / SuperUser-only switch — outside what a sync harness drives (unit- or API-level).
- Empty first names (83 of 6,770 real ACMS records) — expected outcome unknown.
- `trustee-match-verification.findings` for **seeded** pending tasks is `{}`, not a real serialized
  pipeline state. Tasks the sync itself creates are real.
