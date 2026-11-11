# Correct Trustee Zoom Phones Migration

## Overview

A one-time migration for CAMS-975. From 2026-04-03 to 2026-10-06 the Zoom Info Import stored trustee
Zoom phones without validation, so some environments hold values like `(680) 214-4529`. Those values
fail the Zoom phone format check (`123-456-7890`, optionally with a `1-` prefix and an extension),
and users cannot save a trustee's Zoom info without retyping the phone.

The migration reads every trustee that has Zoom info and, for each Zoom phone:

| Outcome       | What happens                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Converted     | The phone is rewritten in the accepted format, e.g. `(680) 214-4529` → `680-214-4529`, `(680) 214-4529 x123` → `680-214-4529 x123`                      |
| Already valid | No change                                                                                                                                               |
| Flagged       | The value cannot be converted safely (wrong number of digits, letters, empty or missing). It is left unchanged and listed in the run summary for review |
| Failed        | The write failed. The trustee is sent to the dead-letter queue and the run continues                                                                    |

Only the phone changes. The rest of the trustee's Zoom info is untouched, and the correction does
**not** create trustee history entries or trustee change notifications, and does not change
`updatedBy`/`updatedOn`.

**Safe to re-run:** a second run converts nothing, because every phone it fixed is now already
valid. Flagged trustees are listed again on every run.

## Run order

Run in **dev**, then **staging**, then **prod**. In each environment, check the summary and the
flagged list (see [Reviewing results](#reviewing-results)) before moving on.

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

| Queue                               | Purpose                           |
| ----------------------------------- | --------------------------------- |
| `correct-trustee-zoom-phones-start` | A message here runs one full pass |
| `correct-trustee-zoom-phones-dlq`   | Failed trustees and run errors    |

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

The review log is Application Insights. Each run writes a single summary entry that holds the counts
and every flagged trustee:

```kusto
AppTraces
| where TimeGenerated > ago(1d)
| where Message has "CORRECT-TRUSTEE-ZOOM-PHONES"
| where Message has "Trustee Zoom phone correction complete"
| project TimeGenerated, Message
```

Example:

```text
Trustee Zoom phone correction complete. Converted: 42, Already valid: 310, Flagged: 2, Failed: 0. Flagged trustees: <id> (Zoom phone has 5 digits.), <id> (Zoom phone is empty or missing.)
```

The entry lists only each flagged trustee's ID and reason, not the trustee's name or phone. Open the
trustee in CAMS (`/trustees/<id>`) to see the stored phone, then fix it by editing the trustee's
Zoom info.

Application Insights sampling is enabled for the dataflows app (`host.json`). Because the counts and
the flagged list are one entry, sampling keeps or drops them together. If no summary appears for a
run, re-run the migration.

**Failed writes:** check `correct-trustee-zoom-phones-dlq`. Each message lists `trusteeId` and
`error`. A message with `"type": "QUEUE_ERROR"` means the run could not load or process trustees at
all. Fix the cause and re-run.
