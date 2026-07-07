# Trustee-Migration Deduplication Verification Runbook

Manual workflow for validating the three duplicate-trustee fixes by running the
**real** `MIGRATE-TRUSTEES` dataflow against the shared environment.

This is NOT a unit/integration test harness that calls use-case functions. The
operator seeds SQL, runs the actual Azure Function locally (which connects to the
shared Azure Gov SQL server and Cosmos via `backend/.env`), then verifies Cosmos
with a read-only Node script.

## What is being validated

| Fix | Fixture | What it proves |
| --- | --- | --- |
| **M1** — `findTrusteeByNameAndState` lookahead-only regex | 1004 (`J. Ford Elsaesser`), 1005 (`William A. Brandt, Jr.`) | Composite names whose tokens end in punctuation match the dedup lookup on run 2 (old `\b` regex never matched → duplicate every run). |
| **M2** — `upsertTrustee` dedup key uses persisted `public.address.state` | 1006 (`Merrill Cohen`, STATE=MD, STATE_A2=DE, A2 public) | Dedup key uses transformed public state `DE`, not raw `MD`. |
| **fallback** — `transformTrusteeRecord` backfills empty public state | 1007 (`Test Fallback`, STATE_A2 blank) | Record persists with `public.address.state='MD'` (backfilled) instead of being skipped. |
| control | 1008 (`Jane Control`) | A clean record isn't spuriously duplicated. |

## 1. Prerequisites

- Local **dataflows** function app configured to point at the shared SQL
  (`sql-ustp-cams.database.usgovcloudapi.net` — ATS / ACMS / DXTR) and Cosmos.
  Config is read from `backend/function-apps/dataflows/.env` (the dataflows app's
  own `.env`, NOT `backend/.env`). In particular these MUST be set:
    - `MONGO_CONNECTION_STRING` — Cosmos Mongo-API connection string
    - `COSMOS_DATABASE_NAME` — database containing the `trustees` collection (e.g. `cams`)
    - `ATS_MSSQL_*` — ATS connection. **The ATS database on this server is named
      `ATS_SUB`** (verified 2026-07-07 by listing `sys.databases`; there is no
      `ATS_REP_SUB`). Set `ATS_MSSQL_DATABASE="ATS_SUB"`.
    - `ACMS_MSSQL_*` — `ACMS_MSSQL_DATABASE="ACMS_REP_SUB"`. **Caveat:** this
      environment's `dbo.CMMPR` does NOT match the gateway query — it has `PROF_CODE`
      (numeric) and no `UST_PROF_CODE`/`PROF_TYPE`, so `getTrusteeProfessionalIds`
      fails here (caught non-fatally; professional-ids will be 0). USTP's real schema
      has those columns; this is a known dev-replica mismatch, out of scope for the
      dedup test. Seed `03` is therefore moot in this environment and can be skipped.
    - Storage: the queue triggers use connection `DataflowsStorage`
      (→ `AzureWebJobsDataflowsStorage`) and the output bindings use
      `AzureWebJobsStorage`. Both are set in `local.settings.json`; in this
      environment they resolve to the SAME Gov storage account, so the queue flow is
      consistent.
    - `CAMS_ENABLED_DATAFLOWS` must include `MIGRATE-TRUSTEES`
- **Restart the dataflows app after any `.env`/`local.settings.json` change** — the
  Functions host reads them once at startup.
- DXTR offices already exist in the shared environment — there is **no DXTR seed**.
  The single-court states used by the fixtures (Idaho, Arizona, Maryland,
  Connecticut) resolve to real DXTR court offices.
- SQL client access to the shared server for the two seed databases (ATS and ACMS
  are **different databases on the same server**).
- Node.js (v22, matching `.nvmrc`) with the repo's hoisted `mongodb` driver
  (already present at repo-root `node_modules` after `npm ci`).

## 2. Seed SQL

1. **ATS** — run `seed/02-seed-dedup-trustees.sql` against the **`ATS_SUB`** database.
   Inserts TRUSTEES rows 1004-1008 plus one active `CHAPTER_DETAILS` row each.
   Idempotent (DELETE-then-INSERT by id 1004-1008). Note: `TRUSTEES.ID` is an
   IDENTITY column, so the file wraps its inserts in
   `SET IDENTITY_INSERT dbo.TRUSTEES ON/OFF` within a single batch.
2. **ACMS** — `seed/03-seed-acms-cmmpr.sql` targets `ACMS_REP_SUB`. **Skip it in
   this environment** — `dbo.CMMPR` here lacks `UST_PROF_CODE`/`PROF_TYPE`, so the
   gateway's professional-id query fails regardless of seeded rows (see the ACMS
   caveat in Prerequisites). It is retained for an environment whose `CMMPR` matches
   USTP's real schema.

No `sqlcmd` is required. A minimal Node runner using the repo's `mssql` package
(parse the dataflows `.env`, connect per-database, split on `GO`, run each batch) is
sufficient. IDENTITY_INSERT and all inserts must stay in one batch (no `GO` between)
so the toggle survives connection pooling.

> Note on `SERVING_STATE`: `02` seeds the full state NAME (e.g. `Idaho`) into
> `CHAPTER_DETAILS.SERVING_STATE` because the cleansing pipeline's court map is
> keyed by full state names. This targets the shared server's real ATS schema (the
> local `00-seed-ats-schema.sql` defines a narrower `CHAR(2)` column for the
> local-only tests — do not use that width assumption against the shared DB).

## 3. Run the dataflow — Run 1 (creates the trustees)

Run 1 populates Cosmos. There is nothing to deduplicate against yet.

1. Start the dataflows app locally (from repo root or `/backend`):
   ```bash
   npm run start:dataflows
   ```
   The dataflows app listens on **port 7072** and uses the **`import`** route prefix
   (from `host.json`), so the trigger is `http://localhost:7072/import/migrate-trustees`
   (NOT `7071`/`api` — that's the API app).
2. Auth is required: `buildStartQueueHttpTrigger` → `isAuthorized` checks
   `Authorization: ApiKey <ADMIN_KEY>` (value from the dataflows `.env`). A missing/
   wrong key returns `403 "Request is Forbidden"`.
   ```bash
   curl -X POST "http://localhost:7072/import/migrate-trustees" \
     -H "Authorization: ApiKey <ADMIN_KEY>"
   ```

The HTTP trigger enqueues an **empty `{}`** start message — no flags. **Important:**
if a prior migration left the state `COMPLETED`, `handleStart` logs "already
completed" and returns WITHOUT enqueuing a page — the `{}` trigger is a no-op. In a
shared environment the state is almost always already `COMPLETED`, so in practice you
drive BOTH runs with a `reset` message (Step 4), not this bare HTTP call. A default
(non-`importAll`) run migrates only trustees with an **active** `CHAPTER_DETAILS` row;
our fixtures each have one with `STATUS='PA'`, so they qualify — no `importAll`
needed. Let the page queue drain until the log reports the migration complete.

## 4. Run the dataflow — Run 2 (the real dedup test)

**Why run 2 is the actual test:** the duplication bug only bites when a matching
trustee doc **already exists**. On run 1 the dedup lookup finds nothing and simply
creates docs. On run 2 the lookup must find the run-1 docs; if the regex (M1) or the
dedup-key state (M2) is wrong, the lookup misses and a **second** doc is created.
So the fix is proven only by run 2 producing **no new docs**.

The migration state doc lives in the **`runtime-state`** collection (documentType
`TRUSTEE_MIGRATION_STATE`), NOT the `trustees` collection. After a run it is
`COMPLETED`, so a bare `{}` HTTP trigger is skipped. To (re)run, enqueue a `reset`
start message. `host.json` sets no `messageEncoding`, so the Storage Queues
extension default (**base64**) applies — the message body must be base64-encoded
JSON.

**Enqueue a reset onto the `migrate-trustees-start` queue.** The most reliable local
method is a Node one-liner with the repo's `@azure/storage-queue`, using the
`AzureWebJobsStorage` connection string from `local.settings.json`:

```js
const { QueueServiceClient } = require('@azure/storage-queue');
const q = QueueServiceClient.fromConnectionString(CONN)
  .getQueueClient('migrate-trustees-start');
await q.createIfNotExists();
await q.sendMessage(Buffer.from(JSON.stringify({ reset: true })).toString('base64'));
```

`reset: true` drives `getOrCreateMigrationState(context, true)` to re-initialize the
state (no longer `COMPLETED`); `handleStart` then enqueues the first page and the run
proceeds over the ATS rows. (`az storage message put` or Storage Explorer work too,
as long as the body is base64.)

**In a shared environment both "run 1" and "run 2" are reset runs** — the state was
already `COMPLETED` from a prior migration, so even the first pass needs a reset.
Run 1 creates the fixture docs; run 2 is the dedup test (must find and update them,
not create duplicates). Let each run drain to `COMPLETED` before the next.

## 5. Verify (read-only)

Run the read-only verification script against the **same** Cosmos environment the
migration targeted:

```bash
export MONGO_CONNECTION_STRING='<cosmos mongo api connection string>'
export COSMOS_DATABASE_NAME='<db containing the trustees collection>'
node test/integration/migrate-trustees/scripts/verify-dedup-cosmos.mjs
# or: node .../verify-dedup-cosmos.mjs --uri '<conn>' --db '<database>'
```

It scopes every query to `legacy.truIds` in `1004`-`1008` and asserts:

- **HARD (pass/fail, sets exit code):**
    - Exactly one `trustees` doc per fixture person (5 groups, each count 1; each
      truId on exactly one doc). This is the dedup result.
    - 1006: `public.address.state === 'DE'` and `internal.address.state === 'MD'` (M2).
    - 1007: `public.address.state === 'MD'` and the doc exists (fallback).
- **INFO (never fails the run):** `>= 1` `trustee-professional-ids`
  (by `camsTrusteeId`) and `>= 1` `trustee-appointments` (by `trusteeId`) per
  fixture. A zero count only means the CMMPR / CHAPTER_DETAILS path wasn't
  exercised — it does not indicate a dedup regression.

A non-zero exit code means a HARD check failed (duplicate or wrong state).

## 6. Cleanup

Per operator instruction, **DO NOT delete the created trustees** (or their
appointments / professional-ids) in Cosmos.

Optionally remove the seeded SQL rows (both are safe, idempotent deletes):

```sql
-- ATS database
DELETE FROM CHAPTER_DETAILS WHERE TRU_ID IN (1004, 1005, 1006, 1007, 1008);
DELETE FROM TRUSTEES        WHERE ID     IN (1004, 1005, 1006, 1007, 1008);

-- ACMS database
DELETE FROM [dbo].[CMMPR] WHERE UST_PROF_CODE IN (99001, 99002, 99003, 99004, 99005);
```
