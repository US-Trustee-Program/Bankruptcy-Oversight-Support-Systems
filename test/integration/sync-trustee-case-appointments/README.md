# sync-trustee-case-appointments — Integration Harness

The grounding and truth for CAMS-955 (ACMS-sourced trustee case appointments) and its interaction
with the trustee-match pipeline. It runs BDD-style scenarios against **real** SQL Server (SQL Edge)
and MongoDB, **in-process**: `source.getEventsForDate` → `processAppointments` → assert the CAMS
state left in Mongo. No Azure Functions host, queues, Azurite or mocks.

Use it to guide development: a scenario that fails is a target, not a mistake. ACMS scenarios report
`NOT IMPLEMENTED` until the ACMS source exists, then start failing or passing on real behavior.

## What it checks

| Group      | What                                                                                                                                 | State today                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `query`    | ACMS fixtures through the **production** `AcmsGateway.getCmmapAppointmentsRaw` (filters, region, change date)                        | 10 pass                           |
| `scenario` | source → sync → CAMS state, per lane. 70 ACMS and 24 DXTR scenario runs, many shared for source parity                               | DXTR 23 pass, 1 finding; ACMS n/i |
| `driver`   | per-region bookmark, catch-up from 2026-07-01, run-date exclusion, named regions, **per-region ACMS/DXTR source routing** (CAMS-957) | not implemented (cams-fd8qd.1.10) |

`n/i` = NOT IMPLEMENTED until the ACMS source exists.

Each scenario is written once in [`scripts/scenarios.ts`](scripts/scenarios.ts), source-neutral, and
rendered into ACMS rows (CMMPR/CMMDB/CMMAP/CMMKE) and/or DXTR rows (AO_CS/AO_PY/AO_TX). Every
scenario carries a `basis` so a guess is never mistaken for a requirement:

- `feature` — a scenario of the same name in
  `test/bdd2/specs/CAMS-955-acms-case-appointment-sync.feature`
- `bead` — a beads issue or `bd` memory (named in `note`)
- `code` — read from production code, not yet a stated requirement
- `provisional` — a conceivable edge case with an unconfirmed expectation; confirm or correct it
  when built

`npm run sync-trustee-case-appointments -- list` prints every scenario with its region, lanes and
basis.

### Fixtures are segmented by region

CAMS-955/956/957 all work per region (per-region bookmarks, per-region ACMS/DXTR source, per-region
tasks), so geography is a first-class part of the fixtures (`GEOGRAPHY` in `scenarios.ts`):

| Region | Group | Division | Court | Notes                                              |
| ------ | ----- | -------- | ----- | -------------------------------------------------- |
| 02     | NY    | 081      | 0208  | Manhattan (real codes)                             |
| 02     | UT    | 066      | 0206  | Utica NY (not Utah); gives region 02 two divisions |
| 03     | PA    | 301      | 0301  | synthetic                                          |
| 04     | DA    | 401      | 0401  | synthetic                                          |

A case id's division prefix determines its region, group and court everywhere (CMMAP `REGION_CODE`,
DXTR `GRP_DES`, the `SYNCED_CASE` document, the identity task's `courtId`). Scenarios cover: read
isolation across regions and change dates, the same compound-key rule across regions, tasks carrying
their own region's court, the core identification/active-trustee/placeholder rules repeated in
regions 03 and 04, and driver scenarios for per-region bookmarks and a region switched to DXTR.

### Fixtures are shaped like staging data

Shapes were profiled from retained staging exports (aggregates only; no real values are stored):
ACMS names are upper-case (the renderer upper-cases every ACMS text field, so every ACMS scenario
also proves case-insensitive matching), suffixes and decorations inside the last name, multi-word
and initial-only first names, 4% with no address and 3.5% with no city/state/zip, phone `0` for 14%,
ZIP+4 everywhere. DXTR variants vary generation, address line 2, phone punctuation, ZIP+4, email and
case. Jurisdiction scenarios span court, division, chapter (7, 11, 12, 13) and appointment status
(active, voluntarily-suspended, resigned) for CAMS-956. Seeded CAMS trustees carry `phoneticTokens`
and the `legacy` block, as real ones do.

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
dispositions. It prints no names or addresses and stores nothing. The 2026-10-05 export (6,770
professionals, 95 groups) already round-trips through the production query.

## The seams

[`scripts/bindings.ts`](scripts/bindings.ts) is the only file that touches unbuilt production code:

1. `getAcmsSource()` — expects `AcmsTrusteeAppointmentSource` exported from
   `backend/lib/use-cases/dataflows/trustee-appointment-source.ts`, no-arg constructor.
2. `runRegionDriver()` — the per-region driver (cams-fd8qd.1.10) including the CAMS-957 source
   switch. The assumed contract is `{ regions, runDate }`. Adapt the binding to the as-built API,
   not the harness.
3. `seedRegionState()` / `readRegionBookmark()` — the **assumed** per-region runtime-state document
   (`regions.<id>.lastSyncDate` and `regions.<id>.source = { system: 'DXTR', ... }`, from
   cams-fd8qd.1.3 and cams-rxb7a). Correct the document type and shape here when the real one
   exists.

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
scripts/start-services.sh                       # MongoDB + SQL Edge (ACMS_INT and DXTR_INT)

cd ..                                           # test/integration
npm run sync-trustee-case-appointments -- seed-schema
npm run sync-trustee-case-appointments -- run
npm run sync-trustee-case-appointments -- run --lane DXTR     # or ACMS
npm run sync-trustee-case-appointments -- run --only known-by-variation
npm run sync-trustee-case-appointments -- run --verbose       # show production log lines
npm run sync-trustee-case-appointments -- clean

cd sync-trustee-case-appointments && scripts/stop-services.sh
```

`.env.local` can be assembled from the sibling `../CAMS` checkout's `test/integration/*/.env.local`
(Mongo + ACMS from `migrate-case-appointments`, DXTR from `trustee-match-scenarios`). The two used
different SA passwords; this harness runs one SQL Edge instance, so set both passwords to the value
in `scripts/.env`. The harness wipes all fixture data between scenarios, so point it only at the
local containers.

## Design decisions

- **Duplication over reuse.** Nothing here imports from another harness, and no shared lib is used.
  Deleting a harness directory is the entire removal. The legacy harnesses this one supersedes are
  tracked in beads: cams-rsn9a (case-trustee-appointments), cams-pcy5m (migrate-case-appointments),
  cams-obj4n (trustee-match-scenarios, trustee-petition-match), cams-l8wr9 (review of
  fix-chapter-7-appointments and backfill-unassigned-on).
- **Variations and pending tasks are derived from the event the source actually returns**
  (`buildVariant`/`computeFingerprint` on the real event), so the harness never assumes how a source
  formats a trustee.
- **DXTR is read as the stub exists today** (`DxtrTrusteeAppointmentSource`, ignores `regionId`,
  reads `TX_DATE > start`), so the harness asks from the day before each change date.
- **Dual-partition check.** Every appointment assertion also checks that `case-trustee-appointments`
  and `trustee-case-appointments` agree.

## Open findings the harness already surfaced

- **DXTR does not skip "United States Trustee (NY)"** — it writes a placeholder and an identity
  task, because `isUnattributableBogusName` only skips when there is no first name. Real ACMS data
  has such names among its 118 skipped professionals. Scenario
  `administrative-placeholder-united-states-trustee` fails today on the DXTR lane (decide whether to
  fix the rule or change the expectation).
- **Ambiguous professional-id link.** `cams-nd7ns` says 2+ links is an integrity error that goes
  straight to a "multiple linked trustees" task; the `.feature` and `cams-fd8qd.1.7` say it falls
  through to variation and the pipeline. Scenario `ambiguous-link-not-used` follows the latter.
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
