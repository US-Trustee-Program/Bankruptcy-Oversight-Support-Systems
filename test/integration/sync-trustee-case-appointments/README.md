# sync-trustee-case-appointments — Integration Harness

The grounding and truth for CAMS-955 (ACMS-sourced trustee case appointments) and its interaction
with the trustee-match pipeline. It runs BDD-style scenarios against **real** SQL Server (SQL Edge)
and MongoDB, **in-process**: `source.getEventsForDate` → `processAppointments` → assert the CAMS
state left in Mongo. No Azure Functions host, queues, Azurite or mocks.

Use it to guide development: a scenario that fails is a target, not a mistake. ACMS scenarios report
`NOT IMPLEMENTED` until the ACMS source exists, then start failing or passing on real behavior.

## What it checks

| Group      | What                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `query`    | ACMS fixtures through the **production** `AcmsGateway.getCmmapAppointmentsRaw` (filters, region, change date). Passes today.      |
| `scenario` | source → sync → CAMS state, per lane (`ACMS`, `DXTR`), many shared for source parity. DXTR runs today; ACMS is `NOT IMPLEMENTED`. |
| `driver`   | per-region bookmark, catch-up from 2026-07-01, run-date exclusion, named regions, per-region ACMS/DXTR source routing (CAMS-957). |

`npm run sync-trustee-case-appointments -- list` and the run summary print the current counts.

Each scenario is written once in [`scripts/scenarios.ts`](scripts/scenarios.ts), source-neutral, and
rendered into ACMS rows (CMMPR/CMMDB/CMMAP/CMMKE) and/or DXTR rows (AO_CS/AO_PY/AO_TX). Every
scenario carries a `basis` so a guess is never mistaken for a requirement:

- `feature` — a scenario of the same name in
  `test/bdd2/specs/CAMS-955-acms-case-appointment-sync.feature`
- `bead` — a beads issue or `bd` memory (named in `note`)
- `decision` — stated by a maintainer in review (named in `note`)
- `code` — read from production code, not yet a stated requirement
- `provisional` — a conceivable edge case with an unconfirmed expectation; confirm or correct it
  when built

### Fixtures are segmented by region

CAMS-955/956/957 all work per region (per-region bookmarks, per-region ACMS/DXTR source, per-region
tasks), so geography is a first-class part of the fixtures (`DIVISIONS` in `scenarios.ts`):

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
regions 03 and 04, and driver scenarios for per-region bookmarks and a region switched to DXTR.

**Bookmark rule (maintainer decision):** for both ACMS and DXTR, a date is complete only when a
later date exists, so the newest date is processed but never bookmarked. Legacy DXTR never held back
the newest date, so this is new behavior for DXTR (tracked in `cams-rxb7a`). Every driver scenario
gives a region a row on a later date than the one it expects to be bookmarked.

### Fixtures are shaped like staging data

Shapes were profiled from retained staging exports (aggregates only; no real values are stored):
ACMS names are upper-case (the renderer upper-cases every ACMS text field, so every ACMS scenario
also proves case-insensitive matching), suffixes and decorations inside the last name, multi-word
and initial-only first names, 4% with no address and 3.5% with no city/state/zip, phone `0` for 14%,
ZIP+4 everywhere. DXTR variants vary generation, address line 2, phone punctuation, ZIP+4, email and
case. Jurisdiction scenarios span court, division, chapter (7, 11, 12, 13) and appointment status
(active, voluntarily-suspended, resigned) for CAMS-956. Seeded CAMS trustees carry `phoneticTokens`
and the `legacy` block, as real ones do, and the Mongo client uses `ignoreUndefined` like
production.

### Replaying real exports (aggregate output only)

```bash
F=../../../CAMS/test/integration/sync-acms-professional-ids-audit/fixtures   # gitignored over there
npm run sync-trustee-case-appointments -- replay \
  --professional-ids $F/2026-10-05-trustee-professional-ids.json \
  --trustees $F/2026-10-05-trustees.json --limit 500 --region 02
```

Seeds one synthetic case and CMMAP row per real professional (one synthetic division per real
group), loads the real CAMS trustees and links, verifies every row comes back through the production
ACMS query, and — once the ACMS source exists — runs the sync and prints only counts: appointments
by `matchedBy`, tasks by reason, DLQ, and agreement with the export's own professional-id
dispositions. It prints no names or addresses.

- The real rows **are loaded into the local containers** and wiped when the command ends (they stay
  in the pod until then). `--verbose` is ignored by replay so production log lines, which can carry
  names, stay hidden.
- Replay seeds export documents verbatim, so it assumes the export's schema matches the current
  repository schema.
- **Never copy exports into this repo.** Keep them in the checkout where they are gitignored.
  (`fixtures/` and `data/` under this directory are ignored only as a safety net.)

## The seams

[`scripts/bindings.ts`](scripts/bindings.ts) is the only file that touches unbuilt production code
or assumed persisted shapes:

1. `getAcmsSource()` — expects `AcmsTrusteeAppointmentSource` exported from
   `backend/lib/use-cases/dataflows/trustee-appointment-source.ts`, no-arg constructor.
2. `runRegionDriver()` — the per-region driver (cams-fd8qd.1.10) including the CAMS-957 source
   switch. The assumed contract is `{ regions, runDate }`. Adapt the binding to the as-built API,
   not the harness.
3. `seedRegionState()` / `readRegionBookmark()` — the **assumed** per-region runtime-state document:
   `region.<id>.lastSyncDate` and `region.<id>.source = { system: 'DXTR', ... }`, following the
   `.feature` file and `cams-nd7ns`. `cams-fd8qd.1.3`'s prose describes a `regions` map instead; the
   beads disagree. Correct the document type and shape here when the real one exists.

When the production code lands, wire these functions; nothing else changes.

## Prerequisites

- Podman (`podman info` works), Node per `.nvmrc`, root `npm ci` done.
- Ground-truth fixture DDL for ACMS is in `seed/00-seed-acms-schema.sql`. It is derived from
  `getCmmapAppointmentsRaw` and the ACMS data dictionary: **`CMMAP.PROF_CODE` joins
  `CMMPR.UST_PROF_CODE`** (both with `GROUP_DESIGNATOR`). CMMAP has no `UST_PROF_CODE` column,
  despite a snippet in the `cams-gateways` skill that implies otherwise.
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
npm run sync-trustee-case-appointments -- run --verbose       # show production log lines
npm run sync-trustee-case-appointments -- clean

cd sync-trustee-case-appointments && scripts/stop-services.sh
```

**Safety.** The harness wipes its databases between scenarios, so it refuses to run any command that
writes (`seed-schema`, `run`, `replay`, `clean`) unless the Mongo host, `ACMS_MSSQL_HOST` and
`MSSQL_HOST` are `localhost`/`127.0.0.1` and `COSMOS_DATABASE_NAME` contains `-idxtest-` (the same
convention as `../_lib/ephemeral-cosmos-database.ts`). It exits 4 when it refuses.

**Exit codes:** `0` all pass, `1` at least one failure (a regression, an unmet expectation or
infrastructure trouble), `2` no failures but some scenarios are `NOT IMPLEMENTED` (targets), `3` a
database is unreachable (preflight), `4` refused by the local-only guard.

`.env.local` can be assembled from the sibling `../CAMS` checkout's `test/integration/*/.env.local`
(Mongo + ACMS from `migrate-case-appointments`, DXTR from `trustee-match-scenarios`). The two used
different SA passwords; this harness runs one SQL Edge instance, so set both passwords to the value
in `scripts/.env`, and change `COSMOS_DATABASE_NAME` to one containing `-idxtest-`. The container
images are pinned (`mongo:7.0.37`, `azure-sql-edge:1.0.7`).

## Design decisions

- **Duplication over reuse.** Nothing here imports from another harness, and no shared lib is used.
  Deleting a harness directory is the entire removal. The legacy harnesses this one supersedes are
  tracked in beads: cams-rsn9a (case-trustee-appointments), cams-pcy5m (migrate-case-appointments),
  cams-obj4n (trustee-match-scenarios, trustee-petition-match), cams-l8wr9 (review of
  fix-chapter-7-appointments and backfill-unassigned-on).
- **Variations and pending tasks are derived from the event the source actually returns**
  (`buildVariant`/`computeFingerprint` on the real event), so the harness never assumes how a source
  formats a trustee.
- **A skip is only proven if the read is.** A pass that expects nothing written must also declare
  `sourceEvents`, otherwise "nothing written" cannot be told from "the source never returned the
  row". `tasksTotal` counts tasks under any name.
- **DXTR is read as the stub exists today** (`DxtrTrusteeAppointmentSource`, ignores `regionId`,
  reads `TX_DATE > start`), so the harness asks from the day before each change date.
- **Dual-partition check.** Every appointment assertion also checks that `case-trustee-appointments`
  and `trustee-case-appointments` agree. Seeded appointments share one `id` across both, as
  production writes them.

## Open findings the harness already surfaced

- **The matching pipeline should filter "United States Trustee (NY)"** (maintainer decision) but
  does not: on the DXTR lane it writes a placeholder and an identity task. Cause: `ny` is not in
  `NON_PERSON_ONLY_WORDS` (`source-name-normalization.helpers.ts`), so `shouldSkipAsNotAPerson` is
  false, and `UST_STAFF_PATTERN` needs "U.S. Trustee". Fix it in the pipeline gate; loosening
  `isUnattributableBogusName`'s `!hasFirstName` rule would skip real trustees because `trustee` is
  itself a bogus keyword. The "(NY)" shape and the first/last split are not evidenced by the export,
  whose UNITED STATES TRUSTEE names are already skipped. Scenario
  `administrative-placeholder-united-states-trustee` fails today; its bare sibling passes.
- **Ambiguous professional-id link.** `cams-nd7ns` says 2+ links is an integrity error that goes
  straight to a "multiple linked trustees" task; the `.feature` and `cams-fd8qd.1.7` say it falls
  through to variation and the pipeline. Scenario `ambiguous-link-not-used` follows the latter.
- **Bookmark rule for DXTR** is new production behavior (above); `cams-rxb7a` should state it.
- No open bead exists for `AcmsTrusteeAppointmentSource` itself.

## Not covered (and why)

- A transient error retries in place — needs fault injection into Cosmos; covered by unit tests.
- A long date continues in a fresh message — needs an injectable invocation budget.
- Slice 3 parking (`CASE_APPOINTMENT_UNATTACHED`), Slice 2 lanes, Slice 4 admin page, the CAMS-956
  Trustee Appointment task, and the CAMS-957 gap report / SuperUser-only switch — not built, or
  API-level. `cams-rxb7a.1` should extend this harness; the driver scenarios already model region
  source routing.
- Empty first names (83 of 6,770 real ACMS records) — expected outcome unknown.
- `trustee-match-verification.findings` for **seeded** pending tasks is `{}`, not a real serialized
  pipeline state. Tasks the sync itself creates are real.
