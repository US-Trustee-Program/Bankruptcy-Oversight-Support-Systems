# Correct Trustee Zoom Phones Migration

## Overview

A one-time migration for CAMS-975. From 2026-04-03 to 2026-10-06 the Zoom Info Import stored trustee
Zoom phones without validation, so some environments hold values like `(555) 010-0123`. Those values
fail the Zoom phone format check (`123-456-7890`, optionally with a `1-` prefix and an extension),
and users cannot save a trustee's Zoom info without retyping the phone.

The migration reads every trustee that has Zoom info and, for each Zoom phone:

| Outcome       | What happens                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Converted     | The phone is rewritten in the accepted format, e.g. `(555) 010-0123` → `555-010-0123`, `(555) 010-0123 x123` → `555-010-0123 x123`, and the trustee's whole Zoom info now passes validation                                                                  |
| Already valid | No change. The phone and the rest of the Zoom info already pass validation                                                                                                                                                                                   |
| Flagged       | Left unchanged and listed in the flagged phones report for review. Either the phone cannot be converted safely (wrong number of digits, letters, not text, empty or missing), or another Zoom info field (link, meeting ID, passcode, email) would still fail the save check |
| Failed        | The write failed for a reason other than throttling. The failure is logged as an error and the run continues                                                                                                                                                 |
| Throttled     | Cosmos DB rate limited (429) a read or write. The migration waits and retries in place, backing off up to 10 minutes. It is not a failure                                                                                                                    |

Only the phone changes. The rest of the trustee's Zoom info is checked and never rewritten, and the correction does
**not** create trustee history entries or trustee change notifications, and does not change
`updatedBy`/`updatedOn`.

**Safe to re-run:** a second run converts nothing, because every phone it fixed is now already
valid. The flagged phones report is rewritten on every run.

**Long or throttled runs:** a run reads every trustee (about 5,000 in prod) and writes once per
converted phone (at most about 2,500, the trustees with Zoom info), so it is expected to take a few
minutes. If throttling would push it
past 56 minutes, the migration puts a continuation message on its own start queue and ends. The
continuation resumes the run after a delay: it re-reads the trustees, skips the ones already
corrected, and carries forward the count of corrections made so far. You do not need to do anything;
the single completion entry appears when the last continuation finishes.

## Run order

Run in **dev**, then **staging**, then **prod**. In each environment, check the summary and the
flagged phones report (see [Reviewing results](#reviewing-results)) before moving on.

Start each run outside business hours. The migration writes each corrected trustee's Zoom info from
the copy it read at the start of the run, so an edit a user makes to that trustee's Zoom info while
the run is in progress can be overwritten.

## Running the migration

### 1. Enable the dataflow

The module is registered but not in the default set, so it only runs where it is listed in
`CAMS_ENABLED_DATAFLOWS`.

- **Deployed environments:** the deploy reads the list from the environment's Key Vault secret
  `CAMS-ENABLED-DATAFLOWS` and passes it to the deployment as `enabledDataflows`
  (`.github/workflows/reusable-deploy.yml`). The `enabledDataflows` parameter default in the bicep
  files is not used, so changing it does nothing. Values are comma-separated, so read the current
  value, append `CORRECT_TRUSTEE_ZOOM_PHONES`, and redeploy:

  ```shell
  az keyvault secret show --vault-name <key-vault> --name CAMS-ENABLED-DATAFLOWS --query value -o tsv
  az keyvault secret set --vault-name <key-vault> --name CAMS-ENABLED-DATAFLOWS \
    --value "<existing values>,CORRECT_TRUSTEE_ZOOM_PHONES"
  ```

- **Local:** set it in the dataflows `local.settings.json`:

  ```shell
  CAMS_ENABLED_DATAFLOWS=CORRECT_TRUSTEE_ZOOM_PHONES
  ```

After the redeploy, the function app's startup log lists `CORRECT-TRUSTEE-ZOOM-PHONES,true`.

### 2. Start a run

There is no HTTP trigger. Put a message containing `{}` on the start queue in the dataflows storage
account:

| Queue                               | Purpose                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `correct-trustee-zoom-phones-start` | A message here runs one pass. A throttled run adds its own continuation messages here |

Nothing else writes to this queue until a throttled run enqueues a continuation, so create it first
if it does not exist (this does nothing when it already exists):

```shell
az storage queue create \
  --account-name <dataflows-storage-account> \
  --name correct-trustee-zoom-phones-start \
  --auth-mode login
```

The queue and message commands with `--auth-mode login` need your identity to hold a data-plane
role on the storage account: Storage Queue Data Message Sender to put a message, and Storage Queue
Data Contributor to create or purge the queue.

The queue trigger expects Base64-encoded messages (`{}` is `e30=`):

- **Azure portal:** open the storage account → Queues → `correct-trustee-zoom-phones-start` → Add
  message, enter `{}`, and check **Encode the message body in Base64**.
- **Azure CLI:**

  ```shell
  az storage message put \
    --account-name <dataflows-storage-account> \
    --queue-name correct-trustee-zoom-phones-start \
    --content e30= \
    --auth-mode login
  ```

### 3. Disable the dataflow

When the migration has run in every environment, remove `CORRECT_TRUSTEE_ZOOM_PHONES` from the
`CAMS-ENABLED-DATAFLOWS` Key Vault secret (keep the other values) and redeploy. Locally, remove it
from `CAMS_ENABLED_DATAFLOWS`.

### Stopping a run

To stop a run, or a chain of continuations, remove `CORRECT_TRUSTEE_ZOOM_PHONES` from the
`CAMS-ENABLED-DATAFLOWS` secret and redeploy, then purge the start queue so no queued continuation
or start message is left:

```shell
az storage message clear \
  --account-name <dataflows-storage-account> \
  --queue-name correct-trustee-zoom-phones-start \
  --auth-mode login
```

Phones already corrected stay corrected, and the migration can be started again later.

## Reviewing results

Review results in either place. Each run ends with one summary entry in Application Insights holding
the counts, every flagged trustee's ID and reason, and where the flagged phones report was written:

```kusto
AppTraces
| where TimeGenerated > ago(1d)
| where Message has "CORRECT-TRUSTEE-ZOOM-PHONES"
| where Message has "Trustee Zoom phone correction complete"
| project TimeGenerated, Message
```

Example:

```text
Trustee Zoom phone correction complete. Converted: 1840, Already valid: 658, Flagged: 2, Failed: 0. Flagged trustees: <id> (Zoom phone has 5 digits.), <id> (Zoom phone is empty or missing.) Flagged report: migration-files/correct-trustee-zoom-phones-flagged.csv
```

The entry lists only each flagged or failed trustee's ID (and the reason for flagged ones), not the
name or phone. The report below adds those for flagged trustees.

**Flagged phones report:** the trustees whose phone could not be converted are written to
`correct-trustee-zoom-phones-flagged.csv` in the object storage container named by
`CAMS_OBJECT_CONTAINER` (`migration-files` by default), in the same storage account as the Zoom Info
Import report. Download it from the portal (storage account → Containers → `migration-files`) or
with the CLI:

```shell
az storage blob download \
  --account-name <storage-account> \
  --container-name migration-files \
  --name correct-trustee-zoom-phones-flagged.csv \
  --file correct-trustee-zoom-phones-flagged.csv \
  --auth-mode login
```

| Column        | Content                                                    |
| ------------- | ---------------------------------------------------------- |
| `trusteeId`   | The trustee's CAMS ID; open `/trustees/<id>` to edit       |
| `trusteeName` | The trustee's name                                         |
| `storedPhone` | The Zoom phone as stored, empty when missing               |
| `reason`      | Why it was not converted: digit count, characters, format, or the names of other Zoom info fields that fail validation (never their values) |

The file is replaced on every run, and holds only the header row when nothing is flagged. A value
that begins with `=`, `+`, `-` or `@` is written with a leading `'` so spreadsheet software does not
read it as a formula. The file contains trustee names and phone numbers, so it has the access of the
storage account. Fix each trustee by editing the trustee's Zoom info in CAMS. When the review is
done, delete the file so the names and phones do not stay in storage:

```shell
az storage blob delete \
  --account-name <storage-account> \
  --container-name migration-files \
  --name correct-trustee-zoom-phones-flagged.csv \
  --auth-mode login
```

**Errors:** there is no dead-letter queue. Every failure is logged as a trace in Application
Insights whose message starts with `[ERROR]`. The dataflows logger sends every level as an
information trace and puts the level in the message text, so filter on the text, not on
`SeverityLevel`:

```kusto
AppTraces
| where TimeGenerated > ago(1d)
| where Message has "CORRECT-TRUSTEE-ZOOM-PHONES"
| where Message has "[ERROR]"
| project TimeGenerated, Message
```

| Error message starts with                       | Meaning                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Failed to write the corrected Zoom phone for…` | One trustee's write failed. The trustee is also listed under `Failed trustees` in summary |
| `Flagged phones report could not be written.`   | The report is missing; the flagged IDs are still in the summary entry                     |
| `Continuation could not be enqueued;`           | A throttled run could not continue; the entry says how many were corrected so far         |
| `Trustee Zoom phone correction failed.`         | The run stopped before finishing, e.g. it could not read the trustees. Corrections already written stay in place |

For any of these, fix the cause and re-run the migration: it is idempotent and retries only the
phones that are still invalid. Only the error message is logged, never the stored Zoom info.

**Poison queue and counts:** after 5 failed deliveries (`maxDequeueCount` in `host.json`) a start
message moves to `correct-trustee-zoom-phones-start-poison`. The handler catches its own errors, so
this happens only when the host itself cannot run it. A re-run, or a start message delivered again
after a partial run, starts its count at zero and reads the trustees corrected earlier as already
valid, so its `Converted` is lower than the true total. Add the `Converted` counts of every summary
in the window together. A chain of continuations carries its count and is not affected.

Application Insights sampling is enabled for the dataflows app (`host.json`). Because the counts and
the trustee lists are one entry, sampling keeps or drops them together. If no summary appears for a
run, the report file is still the complete record of flagged trustees; re-run the migration to
confirm the counts.
