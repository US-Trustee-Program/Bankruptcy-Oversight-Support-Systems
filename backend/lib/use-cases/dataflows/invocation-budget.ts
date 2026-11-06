// Shared invocation time-budget pattern for long-running dataflows that must stop short of the
// Azure Functions execution limit and hand off the remainder via a continuation message, rather
// than being killed mid-write. Generalized from migrate-case-appointments.ts's shouldEscape/
// SAFE_THRESHOLD_MS (CAMS-955 decision 8) — same formula, usable by any caller with a
// next-step-cost estimate (a retry backoff, an estimated page-processing time, etc.).
export const DEFAULT_INVOCATION_BUDGET_MS = 56 * 60 * 1000;

/**
 * True when performing the next step (costing nextStepCostMs) would push wall-clock elapsed
 * time since startedAt to or past safeThresholdMs. Callers use this to decide whether to stop
 * and emit a continuation message instead of starting another step.
 */
export function shouldEscape(
  startedAt: number,
  safeThresholdMs: number,
  nextStepCostMs: number,
): boolean {
  return Date.now() - startedAt + nextStepCostMs >= safeThresholdMs;
}
