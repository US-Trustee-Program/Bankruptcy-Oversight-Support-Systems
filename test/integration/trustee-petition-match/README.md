# Trustee Petition Match — Integration Test

Exercises `SyncTrusteeCaseAppointmentsUseCase`
(`backend/lib/use-cases/dataflows/sync-trustee-case-appointments.ts`) against a real DXTR SQL Server
instance (mimicked locally with SQL Edge), instead of the mocked recordsets used by the unit tests.

## What it tests

1. **Read path** — `getAppointmentEvents()` reads `AO_TX`/`AO_CS`/`AO_CS_DIV`/`AO_PY` via
   `CasesDxtrGateway` and returns correctly-parsed events for both transaction types the use case
   cares about:
   - `TX_TYPE='A'`, `TX_CODE='TR'` — trustee appointment transactions
   - `TX_TYPE='1'`, `TX_CODE='1'` — petition transactions
2. **Match + write path** — `processAppointments()` matches each event to a CAMS trustee via the
   `acmsProfessionalId` fast path, confirms a "perfect match" against a seeded active
   `TrusteeAppointment`, and writes a case appointment + an approved `trustee-match-verification`
   record.

No DDL for the DXTR schema exists elsewhere in this repo — `seed/00-seed-dxtr-schema.sql` is a
hand-crafted subset covering only the columns/joins those two gateway queries use, see its header
comment and the `cams-gateways` skill's `dxtr-schema/` reference files for the full column
definitions this was derived from.

## Warning: isolated databases only

`clean` (and `run`, which calls `clean` first) resets the `TRUSTEE_APPOINTMENTS_SYNC_STATE` and
`TRUSTEE_PETITION_SYNC_STATE` runtime-state documents. These are dataflow-wide singleton watermarks
(keyed only by `documentType`, not by case) — there's no way to scope the reset to just this
harness's fixture case. Only run this harness against an isolated local/test Cosmos database.
Running it against a shared environment would reset the sync cursor for every case the real
`sync-trustee-case-appointments` dataflow is tracking, not just this test's data.

## Environments

Two environments via `INTEGRATION_ENV`:

- `local` (default) — localhost containers started by `start-services.sh`
- `azure` — lower-env Azure Government databases (VPN required)

## Local workflow

```bash
cd trustee-petition-match/scripts
./start-services.sh

cd ../..   # back to test/integration/
npm run trustee-petition-match -- seed-schema
npm run trustee-petition-match -- seed-sql
npm run trustee-petition-match -- seed-cosmos
npm run trustee-petition-match -- run
npm run trustee-petition-match -- clean

cd trustee-petition-match/scripts
./stop-services.sh
```

Before the first run, copy the env templates and fill in a password:

```bash
cp .env.local.template .env.local
cp scripts/.env.template scripts/.env
# set MSSQL_PASS in scripts/.env, and the same value for MSSQL_PASS in .env.local
```

## Commands

| Command       | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `check-env`   | Verify required environment variables are set                               |
| `seed-schema` | (local only) Create `DXTR_INT` database + apply `AO_*` DDL                  |
| `seed-sql`    | Drop/recreate DXTR fixture rows (idempotent)                                |
| `seed-cosmos` | Seed synced case, Trustee, TrusteeProfessionalId, active TrusteeAppointment |
| `run`         | Full test: clean → seed → read DXTR → match/process → assert                |
| `clean`       | Remove seeded rows/documents from both databases                            |
| `help`        | Show usage                                                                  |

## Fixture data

See `seed/01-seed-dxtr-data.sql` for the exact DXTR rows and
`scripts/trustee-petition-match-harness.ts` for the matching Cosmos fixtures. Summary:

- Division `081` (Manhattan), `COURT_ID='0208'`, `GRP_DES='NY'`
- Case `081-26-99999`, chapter `7`, trustee party "Integration Trustee"
- Professional id `NY-00063`, mapped to CAMS trustee `integration-trustee-petition-match-001`
- One appointment transaction (`appointedDate` 2026-06-01) and one petition transaction
  (`appointedDate` 2026-03-01) for the same case — both should auto-match via the professional-id
  fast path against a seeded active `TrusteeAppointment` in the same court/division/chapter.
