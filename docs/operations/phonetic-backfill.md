# Phonetic Token Backfill Migration

## Overview

The phonetic token backfill migration populates the `phoneticTokens` field on existing case documents. This field is required for the phonetic debtor name search feature to find existing cases.

**When to run:** Before enabling the `phonetic-search-enabled` feature flag in production.

**Impact:** Without backfill, existing cases will not appear in phonetic name searches. Only newly imported cases (which automatically generate tokens) will be searchable by name.

## Prerequisites

1. **Enable the dataflow module** by adding `BACKFILL_PHONETIC_TOKENS` to `CAMS_ENABLED_DATAFLOWS`:

   ```shell
   CAMS_ENABLED_DATAFLOWS=BACKFILL_PHONETIC_TOKENS
   ```

2. **Azure Storage connection** configured via `AzureWebJobsDataflowsStorage` in dataflows `local.settings.json`

3. **MongoDB write access** to the cases collection

## Running the Migration

### Local Development

1. Start the dataflows function app:

   ```shell
   cd backend
   npm run start:dataflows
   ```

2. Trigger the migration via HTTP:

   ```shell
   curl -X POST http://localhost:7072/api/backfill-phonetic-tokens
   ```

3. Monitor the terminal output for progress messages.

### Production Environments

For Flexion environments, trigger via Azure CLI:

```shell
az functionapp function invoke \
  --resource-group <resource-group> \
  --name <function-app-name> \
  --function-name backfillPhoneticTokens-httpTrigger
```

For USTP environments, follow the standard deployment procedures to enable the dataflow and trigger via the Azure portal or authorized scripts.

## Migration Architecture

```
┌─────────────────┐
│  HTTP Trigger   │
│  /backfill-     │
│  phonetic-tokens│
└────────┬────────┘
         │ Queues StartMessage
         ▼
┌─────────────────┐     ┌─────────────────┐
│  start queue    │────▶│  handleStart    │
└─────────────────┘     │  - Read state   │
                        │  - Resume/start │
                        └────────┬────────┘
                                 │ Queues CursorMessage
                                 ▼
┌─────────────────┐     ┌─────────────────┐
│  page queue     │◀───▶│  handlePage     │
└─────────────────┘     │  - Fetch batch  │
     │ (loops)          │  - Update tokens│
     │                  │  - Update state │
     │                  └────────┬────────┘
     │                           │ On error
     │                           ▼
     │                  ┌─────────────────┐
     │                  │  dlq queue      │────▶ handleError
     │                  └─────────────────┘           │
     │                                                ▼
     │                                        ┌─────────────────┐
     │                                        │  retry queue    │
     │                                        └────────┬────────┘
     │                                                 │ Max 3 retries
     └─────────────────────────────────────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │  hard-stop queue│
                                              │  (manual review)│
                                              └─────────────────┘
```

### Processing Flow

1. **HTTP Trigger** queues a `StartMessage` to the start queue
2. **handleStart** reads existing state for resumability, queues first `CursorMessage`
3. **handlePage** processes batches of 100 cases using cursor-based pagination:
   - Fetches page using MongoDB cursor
   - Generates and stores `phoneticTokens` for each case
   - Updates state with new cursor position
   - Queues next `CursorMessage` if more cases exist
4. **Error handling** routes failed cases through DLQ → retry (up to 3 times) → hard-stop

### State Management

Migration state is stored in the `runtime-state` collection:

```json
{
  "documentType": "PHONETIC_BACKFILL_STATE",
  "lastId": "xxxxxxxxxx",
  "processedCount": 15000,
  "status": "IN_PROGRESS",
  "startedAt": "2024-01-15T10:00:00.000Z",
  "lastUpdatedAt": "2024-01-15T10:15:30.000Z"
}
```

**Resumability:** If the migration is interrupted, it automatically resumes from the `lastId` cursor position. MongoDB ObjectIds are time-ordered, making cursor-based pagination efficient.

## Monitoring Progress

### Checking Migration Status

Query the runtime-state collection in MongoDB:

```javascript
db.getCollection('runtime-state').findOne({
  documentType: 'PHONETIC_BACKFILL_STATE'
})
```

### Key Log Messages

| Message | Meaning |
|---------|---------|
| "Starting fresh phonetic token backfill migration" | First run |
| "Resuming backfill from cursor X. Already processed Y cases" | Resuming |
| "Processing N cases. Cursor: X -> Y" | Batch in progress |
| "Successfully backfilled N cases. Total processed: M" | Batch complete |
| "Backfill migration complete. Total processed: N cases" | Finished |
| "N cases failed to backfill" | Partial failures (sent to DLQ) |
| "Backfill already completed at X. Skipping." | Already done |

## Troubleshooting

### Migration Seems Stuck

**Symptoms:** No progress messages, processedCount not increasing

**Solutions:**
1. Check the `page` queue in Azure Storage Explorer - messages may be invisible (being processed)
2. Check if the function app is running and healthy
3. Look for error messages in Application Insights or function logs

### Restarting a Failed Migration

The migration automatically resumes from the last successful cursor. Simply re-trigger the HTTP endpoint:

```shell
curl -X POST http://localhost:7072/api/backfill-phonetic-tokens
```

### Force a Fresh Start

If you need to restart from the beginning (ignore previous progress):

1. Delete the state document:

   ```javascript
   db.getCollection('runtime-state').deleteOne({
     documentType: 'PHONETIC_BACKFILL_STATE'
   })
   ```

2. Re-trigger the migration

### Cases in Hard-Stop Queue

Cases that fail 3+ times end up in the hard-stop queue for manual review.

**To investigate:**
1. Check the hard-stop queue messages for case IDs and error details
2. Examine the specific case documents for data issues
3. Fix the root cause (e.g., malformed name data)

**To retry after fixing:**
1. Clear the hard-stop queue
2. Manually update the affected cases, or
3. Reset migration state and re-run

## Configuration Reference

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `CAMS_ENABLED_DATAFLOWS` | Enable the migration module | `BACKFILL_PHONETIC_TOKENS` |
| `AzureWebJobsDataflowsStorage` | Dataflows storage account connection | Connection string |

### Queue Names

| Queue | Purpose |
|-------|---------|
| `backfill-phonetic-tokens-start` | Initiates migration |
| `backfill-phonetic-tokens-page` | Processes batches |
| `backfill-phonetic-tokens-dlq` | Failed cases |
| `backfill-phonetic-tokens-retry` | Retry queue |
| `backfill-phonetic-tokens-hard-stop` | Cases exceeding retry limit |

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `PAGE_SIZE` | 100 | Cases processed per batch |
| `RETRY_LIMIT` | 3 | Max retry attempts before hard-stop |
