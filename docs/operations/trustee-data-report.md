# Trustee Data Report

## Overview

CAMS-977. CAMS trustee profiles were migrated from TOD (ATS), and CAMS edits are supposed to reach
TOD. The trustee data report shows where the two have drifted apart. A SuperUser starts it from
**Admin → Trustee Data Report**, and the dataflows app (the only app that can reach TOD) runs it.

A run reports three kinds of difference:

| Kind      | Meaning                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------- |
| Field     | A linked CAMS trustee's name, company, public or internal address, phone or email differs from TOD |
| TOD only  | A TOD trustee with at least one active appointment that no CAMS trustee links to                   |
| CAMS only | A CAMS trustee with no TOD IDs, or whose TOD IDs no longer exist in TOD                            |

Each CAMS trustee is compared with the profile the original migration would build from all of its
linked TOD records. Differences the migration's own cleanup created are not reported, and neither
are formatting-only differences: case, spacing, phone punctuation and email case.

**What a run writes:** only the `trustee-data-report` Cosmos collection and its run lock (the
`TRUSTEE_DATA_REPORT_RUN` runtime-state document). It reads TOD and the `trustees` collection and
never writes to TOD, trustees or appointments.

**One run at a time.** A second start while a run is active is refused ("A report is already
running"). A lock older than 2 hours belongs to a run that crashed or stalled: the next start takes
it over and marks that run failed.

**Results:** the latest completed run replaces the previous one. A failed run is shown with its
reason next to the last completed results, and leaves those results in place.

## Before the first run in an environment

1. **Deploy** the CAMS-977 changes, including
   `ops/cloud-deployment/lib/cosmos/mongo/cosmos-collections.bicep`:
   - the new `trustee-data-report` collection;
   - a new single-field `legacy.truIds` index on `trustees`. Cosmos builds a new index on an
     existing collection in the background. Queries keep working meanwhile, but a run started before
     it finishes is slower.
2. **Check the dataflows app's TOD settings.** List the setting names only; don't print values:

   ```bash
   az functionapp config appsettings list -g <resource-group> -n <dataflows-app> \
     --query "[?starts_with(name, 'ATS_MSSQL')].name" -o tsv
   ```

   Expect at least `ATS_MSSQL_HOST` and `ATS_MSSQL_DATABASE`. For credentials, a SQL login is used
   whenever both `ATS_MSSQL_USER` and `ATS_MSSQL_PASS` are set, whatever `ATS_MSSQL_AUTH_TYPE` says.
   Otherwise the app uses Azure AD: `ATS_MSSQL_AUTH_TYPE` picks the type (default
   `azure-active-directory-default`, managed identity), with `ATS_MSSQL_CLIENT_ID` for a
   user-assigned identity. So a leftover user and password override managed identity.

   What bad TOD settings look like:
   - **Login rejected:** the run fails on its first page. The tab shows "Could not read from TOD";
     the login error itself is only in the dataflows app's logs and the `TRUSTEE-DATA-REPORT`
     dead-letter queue.
   - **TOD unreachable** (wrong host, firewall): the connection times out, and timeouts are retried
     the same way as Cosmos throttling, 10 times with growing delays. For **about 75 minutes** the
     run shows as running and Start is blocked; then it fails with "TOD timed out and the retries
     ran out". In [Watching a run](#watching-a-run) these attempts count as `throttledRetries`, not
     failures.

   Either way nothing else is affected.

3. The `TRUSTEE-DATA-REPORT` dataflow is enabled by default, so it needs no `CAMS_ENABLED_DATAFLOWS`
   change.

## Running a report

Open **Admin → Trustee Data Report** as a SuperUser and choose **Start report**. The tab checks on
the run every 5 seconds and shows the counts when it finishes.

## Watching a run

In the dataflows app's Application Insights, set the time range to cover the run (the run's
`queuedAt` to `finishedAt`; see [Reading results](#reading-results)):

```kusto
customEvents
| where name == "DataflowHandlerComplete"
| where tostring(customDimensions.moduleName) == "TRUSTEE-DATA-REPORT"
// To see one run only, add: | where tostring(customDimensions.runId) == "<runId>"
| extend handler = tostring(customDimensions.handlerName),
         success = tostring(customDimensions.success),
         error = tostring(customDimensions.error)
| summarize
    firstEvent = min(timestamp),
    lastEvent = max(timestamp),
    pagesRead = countif(handler == "handlePage" and success == "true"),
    throttledRetries = countif(error == "rate-limited-requeued"),
    failures = countif(success == "false" and error != "rate-limited-requeued"),
    avgPageMs = avgif(todouble(customMeasurements.durationMs), handler == "handlePage")
| extend minutes = datetime_diff('minute', lastEvent, firstEvent)
```

`pagesRead` includes the final empty page that finishes the run, so TOD pages = `pagesRead - 1` (100
TOD trustees per page). Throttled retries are not failures: the page is retried with a backoff, up
to 10 times (about 75 minutes in all). They include TOD timeouts as well as Cosmos throttling, so a
run with many throttled retries and no progress usually means TOD is unreachable.

## Reading results

Use the Mongo shell against the environment's CAMS database. **Do not export or save difference
rows**: they contain trustee names and contact details. Record counts and conclusions only.

```js
// The latest completed run, with its summary counts and timings.
const run = db
  .getCollection('trustee-data-report')
  .find({ documentType: 'TRUSTEE_DATA_REPORT_RUN', status: 'completed' })
  .sort({ finishedAt: -1 })
  .limit(1)
  .next();
printjson({
  runId: run.runId,
  queuedAt: run.queuedAt,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  summary: run.summary,
});

// Failed runs, newest first, with their reasons.
db.getCollection('trustee-data-report')
  .find(
    { documentType: 'TRUSTEE_DATA_REPORT_RUN', status: 'failed' },
    { runId: 1, finishedAt: 1, failureMessage: 1 },
  )
  .sort({ finishedAt: -1 })
  .limit(5);
```

## Verifying a run (staging, before prod)

Record each result in the slice notes (`bd update cams-f798g.1 --append-notes "..."`). Counts and
conclusions only, no trustee data.

### 1. Before starting: note trustee activity

So the "nothing was written" check has a baseline:

```js
const before = new Date().toISOString();
print(before);
```

Prefer a quiet period: no users editing trustees, and away from the trustee appointment sync, which
runs at 12:30 and 18:30 UTC and updates `trustee-appointments`. Either one shows up in step 5 and
needs to be told apart from the report.

### 2. Run it and record timings

Start the report from the Admin tab, wait for it to finish, then record from
[Watching a run](#watching-a-run): minutes, TOD pages, average page time, throttled retries and
failures. These size the prod run.

### 3. Spot-check at least 5 field differences

```js
const run = db
  .getCollection('trustee-data-report')
  .find({ documentType: 'TRUSTEE_DATA_REPORT_RUN', status: 'completed' })
  .sort({ finishedAt: -1 })
  .limit(1)
  .next();
db.getCollection('trustee-data-report').aggregate([
  { $match: { documentType: 'TRUSTEE_DATA_REPORT_DIFFERENCE', runId: run.runId, kind: 'field' } },
  { $sample: { size: 5 } },
]);
```

For each row, compare both sides at the source:

```js
db.trustees.findOne(
  { documentType: 'TRUSTEE', trusteeId: '<camsTrusteeId>' },
  { name: 1, public: 1, internal: 1, 'legacy.truIds': 1 },
);
```

```sql
SELECT ID, FIRST_NAME, MIDDLE, LAST_NAME, COMPANY, STREET, STREET1, CITY, STATE, ZIP, ZIP_PLUS,
       STREET_A2, STREET1_A2, CITY_A2, STATE_A2, ZIP_A2, ZIP_PLUS_A2, TELEPHONE, EMAIL_ADDRESS,
       DISP_ON_WEB, DISP_ON_WEB_A2
FROM TRUSTEES WHERE ID IN (<todIds>);
```

Each difference should be a real change, not formatting (case, spacing, punctuation) and not the
migration's own cleanup (trimmed names, formatted phones and ZIP codes). For a trustee linked to
several TOD records, the report compares against the most complete record (lowest ID on a tie).
Record how many of the 5 were real, and describe any that were not.

### 4. Count trustees merged across migration pages

The trustee migration read TOD 50 trustees at a time in ID order. When one person's TOD records fell
on different pages, the later page overwrote the CAMS profile with that page's best record, which
may not be the best record overall. The report compares against the best record overall, so those
trustees can show **false** differences.

First list every CAMS trustee linked to more than one TOD record, as SQL rows (IDs only):

```js
db.trustees
  .find(
    { documentType: 'TRUSTEE', 'legacy.truIds.1': { $exists: true } },
    { trusteeId: 1, 'legacy.truIds': 1 },
  )
  .forEach((t) => t.legacy.truIds.forEach((id) => print(`('${t.trusteeId}', ${Number(id)}),`)));
```

Paste the rows (dropping the last comma) into this TOD query:

```sql
WITH ranked AS (
  SELECT ID, (ROW_NUMBER() OVER (ORDER BY ID) - 1) / 50 AS migration_page FROM TRUSTEES
),
links (trustee_id, tod_id) AS (
  SELECT * FROM (VALUES
    -- rows from the Mongo shell
  ) v (trustee_id, tod_id)
)
SELECT l.trustee_id
FROM links l JOIN ranked r ON r.ID = l.tod_id
GROUP BY l.trustee_id
HAVING COUNT(DISTINCT r.migration_page) > 1;
```

The result lists the trustees merged across pages. It's an estimate: it uses today's TOD, so
trustees added or removed since the migration shift the pages, and it assumes the migration read all
TOD trustees (`importAll`, its default).

Then count how many of those trustees the report flagged:

```js
const crossPage = ['<trusteeId>' /* ... from the SQL result */];
db.getCollection('trustee-data-report').distinct('camsTrusteeId', {
  documentType: 'TRUSTEE_DATA_REPORT_DIFFERENCE',
  runId: run.runId,
  kind: 'field',
  camsTrusteeId: { $in: crossPage },
}).length;
```

Record both counts and a recommendation: if few cross-page trustees are flagged, document the
caveat; if many are, the report needs to account for the migration's page order before prod.

### 5. Confirm nothing was written to trustee data

```js
const runWindow = { $gte: before, $lte: run.finishedAt };
db.trustees.countDocuments({ documentType: 'TRUSTEE', updatedOn: runWindow });
db.trustees.countDocuments({ documentType: { $regex: '^AUDIT_' }, updatedOn: runWindow });
db.getCollection('trustee-appointments').countDocuments({ updatedOn: runWindow });
```

All three should be 0, or match user edits and, for `trustee-appointments`, an appointment sync that
ran during the window (12:30 and 18:30 UTC). The report only runs `SELECT` queries against TOD; in
the dataflows app's logs for the run, confirm there are no errors from the ATS gateway other than
reads.

## Troubleshooting

| What you see                                                          | What it means                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "A report is already running" when starting                           | Another run holds the lock. Wait for it to finish; the tab shows its progress                                                                                                                                                                                                       |
| "Could not read from TOD" or "TOD timed out"                          | The dataflows app's `ATS_MSSQL_*` settings are missing or wrong. The exact error is in the dataflows app's logs and the dead-letter queue. See [Before the first run](#before-the-first-run-in-an-environment)                                                                      |
| "See the dataflows app's logs for run ..."                            | An unexpected error. Search the dataflows app's logs for the run ID                                                                                                                                                                                                                 |
| "The run did not finish within 2 hours and was replaced by a new run" | The earlier run crashed or stalled, and a later start took over its lock. Check the dataflows app's logs and the `TRUSTEE-DATA-REPORT` dead-letter queue for the cause                                                                                                              |
| "...no longer holds the run lock"                                     | The run ran past 2 hours and another start took over. If runs routinely take this long, report it                                                                                                                                                                                   |
| A run stays "running" and the tab keeps waiting                       | If [Watching a run](#watching-a-run) shows throttled retries climbing with no new pages, TOD is probably unreachable; the run fails after about 75 minutes. Otherwise check the `TRUSTEE-DATA-REPORT` page and dead-letter queues. After 2 hours a new start can take over the lock |
