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
- This is a best-effort guard. A competing claim can still win in a narrow window: it needs a
  second start that read no lock before this claim's write and wrote after its read-back. Lanes of
  the losing start stop at `isCurrentRun` before any write, but that start's `deleteAll`, if set,
  has already run.
- The lock gates starts only. Page retries (`handlePage`) and the 18:30 UTC heal do not check it.

See `sync-trustee-case-appointments.ts`'s `handleStart` for a caller.
