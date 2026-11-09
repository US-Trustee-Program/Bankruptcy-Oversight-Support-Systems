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
