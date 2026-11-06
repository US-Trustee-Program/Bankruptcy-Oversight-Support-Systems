# sync-trustee-case-appointments — Integration Harness

The grounding and truth for CAMS-955 (ACMS-sourced trustee case appointments) and its interaction
with the trustee-match pipeline. It runs BDD-style scenarios against **real** SQL Server (SQL Edge)
and MongoDB, **in-process**: `source.getEventsForDate` → `processAppointments` → assert the CAMS
state left in Mongo. No Azure Functions host, queues, Azurite or mocks.

Use it to guide development: a scenario that fails is a target, not a mistake. ACMS scenarios report
`NOT IMPLEMENTED` until the ACMS source exists, then start failing or passing on real behavior.

## What it checks

| Group      | What                                                                                                                    | State today                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `query`    | ACMS fixtures through the **production** `AcmsGateway.getCmmapAppointmentsRaw` (filters, region, change date)           | passes                            |
| `scenario` | source → sync → CAMS state, per lane (`ACMS`, `DXTR`). ~29 ACMS and 10 DXTR scenarios, several shared for source parity | DXTR passes; ACMS not implemented |
| `driver`   | per-region bookmark, catch-up from 2026-07-01, run-date exclusion, named regions                                        | not implemented (cams-fd8qd.1.10) |

Each scenario is written once in [`scripts/scenarios.ts`](scripts/scenarios.ts), source-neutral, and
rendered into ACMS rows (CMMAP/CMMDB/CMMPR/CMMKE) and/or DXTR rows (AO_CS/AO_PY/AO_TX). Every
scenario carries a `basis` so a guess is never mistaken for a requirement:

- `feature` — a scenario of the same name in
  `test/bdd2/specs/CAMS-955-acms-case-appointment-sync.feature`
- `bead` — a beads issue or `bd` memory (named in `note`)
- `code` — read from production code, not yet a stated requirement
- `provisional` — a conceivable edge case with an unconfirmed expectation; confirm or correct it
  when built

`npm run sync-trustee-case-appointments -- list` prints every scenario with its lanes and basis.

## The two seams

[`scripts/bindings.ts`](scripts/bindings.ts) is the only file that touches unbuilt production code:

1. `getAcmsSource()` — expects `AcmsTrusteeAppointmentSource` exported from
   `backend/lib/use-cases/dataflows/trustee-appointment-source.ts`, no-arg constructor.
2. `runRegionDriver()` — the per-region driver (cams-fd8qd.1.10). The assumed contract is
   `{ regions, runDate }`. Adapt the binding to the as-built API, not the harness.

When the production code lands, wire these two functions; nothing else changes.

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

## Not covered (and why)

- A transient error retries in place — needs fault injection into Cosmos; covered by unit tests.
- A long date continues in a fresh message — needs an injectable invocation budget.
- Slices 2–4 (lanes, parking/healing, admin page) and CAMS-957 region routing — not built; add
  scenarios when designed. `cams-rxb7a.1` should extend this harness.
- `trustee-match-verification.findings` for **seeded** pending tasks is `{}`, not a real serialized
  pipeline state. Tasks the sync itself creates are real.
