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

See `backend/lib/use-cases/dataflows/migrate-case-appointments.ts` for a caller.
