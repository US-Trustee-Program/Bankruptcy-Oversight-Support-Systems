# Correct Trustee Zoom Phones Migration

## Overview

A one-time migration for CAMS-975. From 2026-04-03 to 2026-10-06 the Zoom Info Import stored trustee
Zoom phones without validation, so some environments hold values like `(680) 214-4529`. Those values
fail the Zoom phone format check (`123-456-7890`, optionally with a `1-` prefix and an extension),
and users cannot save a trustee's Zoom info without retyping the phone.

The migration reads every trustee that has Zoom info and, for each Zoom phone:

| Outcome       | What happens                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Converted     | The phone is rewritten in the accepted format, e.g. `(680) 214-4529` → `680-214-4529`, `(680) 214-4529 x123` → `680-214-4529 x123`                                |
| Already valid | No change                                                                                                                                                         |
| Flagged       | The value cannot be converted safely (wrong number of digits, letters, empty or missing). It is left unchanged and listed in the flagged phones report for review |
| Failed        | The write failed for a reason other than throttling. The trustee is sent to the dead-letter queue and the run continues                                           |
| Throttled     | Cosmos DB rate limited (429) a read or write. The migration waits and retries in place, backing off up to 10 minutes. Nothing goes to the dead-letter queue       |

Only the phone changes. The rest of the trustee's Zoom info is untouched, and the correction does
**not** create trustee history entries or trustee change notifications, and does not change
`updatedBy`/`updatedOn`.

**Safe to re-run:** a second run converts nothing, because every phone it fixed is now already
valid. The flagged phones report is rewritten on every run.

**Long or throttled runs:** a run is expected to take a few minutes. If throttling would push it
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

- **Deployed environments:** add `CORRECT_TRUSTEE_ZOOM_PHONES` to the `enabledDataflows` deployment
  parameter (`ops/cloud-deployment/main.bicep`, applied to the function app by
  `dataflows-resource-deploy.bicep` as `CAMS_ENABLED_DATAFLOWS`). Values are comma-separated, so
  keep anything already listed:

  ```shell
  enabledDataflows=<existing values>,CORRECT_TRUSTEE_ZOOM_PHONES
  ```

- **Local:** set it in the dataflows `local.settings.json`:

  ```shell
  CAMS_ENABLED_DATAFLOWS=CORRECT_TRUSTEE_ZOOM_PHONES
  ```

After the function app restarts, its startup log lists `CORRECT-TRUSTEE-ZOOM-PHONES` as set up.

### 2. Start a run

There is no HTTP trigger. Put a message containing `{}` on the start queue in the dataflows storage
account:

| Queue                               | Purpose                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `correct-trustee-zoom-phones-start` | A message here runs one pass. A throttled run adds its own continuation messages here |
| `correct-trustee-zoom-phones-dlq`   | Failed writes and run errors                                                          |

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

When the migration has run in every environment, remove `CORRECT_TRUSTEE_ZOOM_PHONES` from
`enabledDataflows` / `CAMS_ENABLED_DATAFLOWS` and redeploy.

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
Trustee Zoom phone correction complete. Converted: 42, Already valid: 310, Flagged: 2, Failed: 0. Flagged trustees: <id> (Zoom phone has 5 digits.), <id> (Zoom phone is empty or missing.) Flagged report: migration-files/correct-trustee-zoom-phones-flagged.csv
```

The entry lists only each flagged trustee's ID and reason, not the name or phone. The report below
adds those.

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
| `reason`      | Why it was not converted (digit count, characters, format) |

The file is replaced on every run, and holds only the header row when nothing is flagged. A value
that begins with `=`, `+`, `-` or `@` is written with a leading `'` so spreadsheet software does not
read it as a formula. The file contains trustee names and phone numbers, so it has the access of the
storage account. Fix each trustee's phone by editing the trustee's Zoom info in CAMS.

If the summary reports a flagged count but no report location, the report could not be written. The
dead-letter queue then holds a `QUEUE_ERROR` message with the cause, and the flagged IDs are still
in the summary entry. Fix the cause and re-run.

Application Insights sampling is enabled for the dataflows app (`host.json`). Because the counts and
the flagged list are one entry, sampling keeps or drops them together. If no summary appears for a
run, the report file is still the complete record; re-run the migration to confirm the counts.

**Failed writes:** check `correct-trustee-zoom-phones-dlq`. Each message lists `trusteeId` and
`error`. Re-run the migration: it is idempotent and retries only the phones that are still invalid.
A message with `"type": "QUEUE_ERROR"` means the run could not load or process trustees at all. Fix
the cause and re-run.
