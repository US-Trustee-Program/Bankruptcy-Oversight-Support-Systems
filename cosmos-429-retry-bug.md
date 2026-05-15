---
name: Bug Report
about: Report a defect or unexpected behavior in CAMS
title: '[BUG] Cosmos DB 429 errors cause silent case drop in sync-cases and other dataflows'
labels: bug
assignees: ''
---

## Summary

When Cosmos DB returns a 429 (TooManyRequests) error during dataflow processing, affected cases are silently dropped or sent to the DLQ without retry. The `sync-cases` dataflow has no 429 handling at all. As a result, cases that hit rate limits during high-throughput sync periods are never synced, causing incomplete case data in CAMS without any visible indication to staff.

## Environment

- [ ] Dev
- [ ] Staging
- [x] Production

## Steps to Reproduce

1. Run the sync-cases dataflow during a high-throughput period that causes Cosmos DB to return 429 responses
1. Observe that cases included in the rate-limited batch do not appear in CAMS
1. Check the DLQ — cases may or may not appear there depending on which handler was hit; either way they are not retried

## Expected Behavior

Cases that fail with a Cosmos DB 429 error are re-enqueued with exponential backoff and successfully synced once the rate limit window passes. After exceeding a retry limit, unresolvable cases are routed to the DLQ with a structured error entry. All retry attempts are recorded in Application Insights telemetry.

## Actual Behavior

429 errors are not specifically detected in sync-cases or most other dataflows. The affected case is either silently dropped (if the error is swallowed) or sent directly to the DLQ on first failure with no retry. No telemetry is emitted to indicate rate-limit pressure is occurring.

## Likely Root Cause

The `isTooManyRequestsError` utility exists in `backend/lib/common-errors/too-many-requests-error.ts` and a working retry pattern (exponential backoff via `StorageQueueHumbleObject` + visibility timeout) was implemented in `resync-remaining-cases.ts`, but neither was applied to the ongoing sync dataflows. The pattern needs to be extracted into a shared utility and wired into all dataflows that write to Cosmos DB.

## Notes

- Reference implementation: `backend/function-apps/dataflows/migrations/resync-remaining-cases.ts` lines ~130–175
- Use `AzureWebJobsDataflowsStorage` (not `AzureWebJobsStorage`) for the queue connection string — see review findings on `handle-missed-division-changes` for context on this footgun
- Affected dataflows: sync-cases, sync-orders, sync-office-staff, sync-trustee-appointments, sync-deleted-cases, sync-trustee-due-date-metrics, sync-trustee-notes-metrics, and relevant migrations
- Consider extracting a shared `handleRateLimitRetry` utility before wiring into each dataflow to avoid copy-paste drift
- Future follow-up: add an Application Insights alert threshold on a `RateLimitRetry` metric to detect sustained rate-limit pressure proactively
