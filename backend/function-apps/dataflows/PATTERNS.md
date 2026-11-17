# Dataflow Patterns

Recurring patterns shared across dataflows in this directory. Add a section here when a pattern is
extracted into a shared module so the next dataflow author finds it instead of re-implementing it.

## Invocation time budget + continuation

**Module:** `backend/lib/use-cases/dataflows/invocation-budget.ts`

A long-running dataflow invocation must stop short of the Azure Functions execution timeout and hand
off remaining work via a continuation message, rather than being killed mid-write.

- `DEFAULT_INVOCATION_BUDGET_MS` (56 minutes) is the safe threshold for a 60-minute
  `functionTimeout`, leaving a 4-minute buffer.
- `shouldEscape(startedAt, safeThresholdMs, nextStepCostMs)` returns `true` when performing the next
  step would push wall-clock elapsed time since `startedAt` to or past `safeThresholdMs`.
  `nextStepCostMs` is whatever the caller's next step costs — a retry backoff delay, an estimated
  page-processing time, etc.
- When `shouldEscape` returns `true`, stop processing and queue a continuation message carrying
  enough state to resume (e.g. the current cursor) instead of starting another step.

See `backend/lib/use-cases/dataflows/trustee-appointment-region-driver.ts` for a caller.

## One-time migration: in-place 429 backoff, stateless continuation, CSV review report

**Modules:** `backend/lib/use-cases/dataflows/dataflow-backoff.ts` (with `invocation-budget.ts`
above)

For a bounded, idempotent, one-time repair of a collection small enough to read whole (thousands of
documents, not millions). It is the single-invocation counterpart to `fix-chapter-7-appointments`'s
reader/writer queues, and to the queue-level `handleRateLimitRetry` in `dataflows-rate-limit.ts`,
which requeues a whole message rather than waiting inside the invocation.

- **Read once, write one record at a time.** The pass reads the collection with one call, filters in
  memory, and writes each record that needs repair with its own sequential call. At this size the
  cost is a few minutes and a small, self-paced RU load; bulk writes would need new adapter code for
  no benefit.
- **A 429 is never a failure.** Wrap every Cosmos call in
  `retryOnRateLimit(operation, { startedAt, safeThresholdMs, baseDelayMs, onBackoff })`. It sleeps
  and retries in place on `TooManyRequestsError` (first wait is twice `baseDelayMs`, doubling to a
  10-minute cap) and rethrows anything else. Wrap the read and each write separately so a throttled
  write retries that record, not the pass.
- **Escape instead of overrunning.** Once the next backoff would reach the safe threshold,
  `retryOnRateLimit` returns `{ kind: 'escape', backoffMs }` without sleeping. The use case turns
  that into `{ kind: 'escape', state, backoffSeconds }`.
- **Continuation state is only what cannot be re-derived.** The next invocation re-reads the data,
  and records already repaired no longer need repair, so it finds the remaining work itself and
  there is no cursor or unwritten-batch hand-off. The state carries only what the final report needs
  (here, a count of repairs made earlier, about 40 bytes encoded), so it cannot approach the queue
  message limit below. The handler enqueues the continuation on the dataflow's own start queue with
  a visibility delay of a fixed 30 seconds plus `backoffSeconds`.
  `StorageQueueHumbleObject.sendMessage` Base64-encodes the body and creates the queue if missing.
- **The run ends when a pass finishes without an escape.** That pass is the final one: it recomputes
  every outcome from current data and writes the single completion log entry. Outcomes derived from
  data (already valid, flagged) are never accumulated across continuations, so they cannot be
  double-counted; adjust only for repairs that earlier passes made and this pass now reads as
  already valid.
- **Errors are logged, not dead-lettered.** A one-time run has no consumer for a DLQ, and a DLQ
  message cannot carry many records (see Queue message size below). Log each failed write at Error
  level with the record id and the message text only, never the error object: the Mongo adapter
  attaches the query and the item being written to the errors it throws. List the failed ids in the
  one completion entry, so sampling cannot hide which records failed. A run-level error (the read
  failing, the report or the continuation not written) is also an Error log that says what the
  operator does next, which is re-run.
- **Records that need a human go to a CSV.** Written with
  `factory.getObjectStorageGateway(context).writeObject(getMigrationFilesContainerName(), blobName, content)`,
  as `import-zoom-csv.ts` does for its report. Overwrite the same blob each run so it always
  reflects the latest run, and write the header alone when nothing needs review so an old report is
  not mistaken for the current one. The CSV holds only what identifies the record and the bad value.
  Quote cells containing commas, quotes, or line breaks, and prefix a value starting with `=`, `+`,
  `-` or `@` with `'` because the data being reported is arbitrary. The one completion log entry
  also lists each such record's id and reason, so review does not depend on the file alone, and
  sampling keeps or drops the counts and the list together. A failure to write the report is logged
  as an Error, and the completion log omits the report location.
- **Re-running is the recovery path.** Repaired records are skipped and the report is regenerated,
  so an operator who finds failures, a missing report, or a stuck run starts it again.

See `backend/function-apps/dataflows/migrations/correct-trustee-zoom-phones.ts` and
`backend/lib/use-cases/dataflows/correct-trustee-zoom-phones.ts` (`runCorrectionPass`,
`writeFlaggedReport`) for a caller. `fix-chapter-7-appointments.ts` uses the same backoff curve for
an unbounded, loop-until-empty variant.

## Queue message size (64 KB)

**Module:** `backend/function-apps/dataflows/dataflows-paging.ts`

An Azure Storage Queue message body is capped at 65,536 bytes after Base64 encoding, which both the
Functions storage queue binding and `StorageQueueHumbleObject.sendMessage` apply. Anything that puts
a variable number of records into one message needs to measure it, as a fixed record count is only a
guess about record size.

- `pageByByteBudget(items, maxPageSize?)` returns `{ pages, rejected }`. Each page stays within a
  JSON budget of `floor(65536 × 3/4) − 1024` bytes (about 48 KB), which leaves room for Base64 and
  an envelope. It measures `Buffer.byteLength(JSON.stringify(page))` of the candidate page itself,
  not the sum of the item sizes: the array's own commas and brackets add up, and summing them let a
  page through that caused a production `RequestBodyTooLarge` (413). An item too large to fit alone
  is returned in `rejected` and is never placed on a page. `maxPageSize` also caps the item count.
- `extraOutputs.set(binding, value)` sends exactly one queue message per invocation, whatever the
  value. Setting an array of pre-built pages collapses them into one oversized message. Send each
  page as its own message with `StorageQueueHumbleObject.fromConnectionString(...).sendMessage`, and
  report each rejected item separately.
- The best fix is not needing it: keep continuation state to a few scalars, and send per-record
  output to logs or object storage rather than to a queue, as the migration pattern above does.
- There is no helper for a single unpaged message, so when a message's size is a design assumption,
  pin it with a test that checks `Buffer.byteLength` of the serialized body.

See `queueEventPages` in `backend/function-apps/dataflows/import/sync-trustee-case-appointments.ts`
for a caller that pages events and dead-letters rejected ones, and `handleReader` in
`backend/function-apps/dataflows/migrations/fix-chapter-7-appointments.ts` for escape-hatch writer
pages.

## Fan-out across K lanes + capacity

**Module:** `backend/lib/use-cases/dataflows/lane-assignment.ts`

A dataflow that must process many independent units of work (regions, office groups, etc.) against a
downstream source with limited capacity (ACMS, a legacy SQL database) needs to bound how many of
those units are queried concurrently. host.json's queue settings (`batchSize`,
`functionAppScaleLimit`) apply app-wide and are not a per-dataflow control — relying on them led to
unbounded fan-out overwhelming ACMS with SQL timeouts (see commit `5fbd22a29`, CAMS-876). The fix
there was to serialize everything into one self-requeuing chain (exactly one query in flight,
regardless of scale-out); this pattern generalizes that to K independent chains instead of one, when
a single chain would be too slow to keep up.

- `assignLanesRoundRobin(units, laneCount)` sorts the unit list and interleaves it by
  `index % laneCount`, returning `laneCount` fixed arrays (including empty ones if there are fewer
  units than lanes). Round-robin, not a contiguous split, so uneven per-unit workloads are spread
  across lanes rather than risking a contiguous block of heavy units landing in one lane.
  Deterministic from the unit list alone — no persisted lane-assignment state between runs.
- `pickJitterSeconds(minSeconds, maxSeconds)` returns a random delay, used on each lane's first
  message only, so K lanes don't all query the downstream source in the same instant at run start.
- Each lane becomes its own independent, self-requeuing serial chain (the same single-chain
  continuation pattern from the section above, parameterized by that lane's unit list). At any
  instant a lane has at most one invocation in flight, because the next message for that lane
  doesn't exist until the current invocation finishes and enqueues it — so K lanes bound concurrency
  to K with no semaphore, lock, or host.json change, purely as a structural property of "K
  independent single chains."

See `backend/function-apps/dataflows/import/sync-trustee-case-appointments.ts`'s `handleStart` for a
caller: a start message with no region list enumerates every region, splits it into lanes via
`assignLanesRoundRobin`, and sends one jittered `START` message per non-empty lane — each then runs
through the same single-chain code path a named-region start message already used.

## Run lock for a multi-lane run

**Module:** `backend/lib/use-cases/dataflows/trustee-appointment-sync-run.ts`

The K-lane bound above holds within one run. A lock document in runtime state
(`TRUSTEE_APPOINTMENT_SYNC_RUN`) keeps a second start from adding K more chains.

- Every start that is not a lane of a running sync (timer kickoff, operator start, or a requeue of
  either) mints a `runId` and calls `claimRun`. If a lock exists for a different run, the start
  skips and logs a warning. Otherwise it writes the lock, waits `CLAIM_CONFIRM_DELAY_MS`, and reads
  it back; only the start whose `runId` is still there proceeds.
- Every lane message, continuation and transient requeue carries the `runId`. A lane first checks
  `isCurrentRun` and stops if another run holds the lock.
- The kickoff records `lanesRemaining` before it sends lanes. A lane whose chain ends with nothing
  left to continue calls `completeLane`; the one that brings the count to zero deletes the lock.
- The lock has no expiry. A run that dies (dead-lettered, retries exhausted, or a continuation that
  could not be requeued) keeps the lock, and later starts skip until an operator deletes the
  `TRUSTEE_APPOINTMENT_SYNC_RUN` document in runtime-state after finding the cause.
- This is a best-effort guard. A competing claim can still win in a narrow window: it needs a second
  start that read no lock before this claim's write and wrote after its read-back. Lanes of the
  losing start stop at `isCurrentRun` before any write, but that start's `delete`, if set, has
  already run.
- The lock gates starts only. Page retries (`handlePage`) and the 18:30 UTC heal do not check it.
- `claimRun` returns claimed without rewriting the lock when it already carries this `runId`, which
  is how a requeued start resumes. A new claim writes `lanesRemaining: 1`, which is what lets an
  operator-named single chain release the lock; a fan-out overwrites it with the lane count. The
  lock's `runId` and `startedAt` tell an operator which run holds it and since when.
- Replaying a dead-lettered start message: a lane message carries `runId` and `laneId`; replay it
  without touching the lock, since its run still owns it and its completion releases the lock. A
  kickoff or operator start carries no `runId`; delete the lock first, then replay. A lane send that
  failed partway through a fan-out dead-letters the kickoff with the lock held; delete the lock,
  then replay the kickoff. Waiting for the next daily kickoff does not recover: it finds the lock
  held and skips with `run-active`. Replaying in the wrong order is a logged skip, not data loss.

See `sync-trustee-case-appointments.ts`'s `handleStart` for a caller.
