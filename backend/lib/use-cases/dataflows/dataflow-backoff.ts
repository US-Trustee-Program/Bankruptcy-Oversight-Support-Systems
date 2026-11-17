import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { shouldEscape } from './invocation-budget';

/**
 * In-process backoff helpers for dataflow use cases that retry a throttled (429) Cosmos call in
 * place and hand any remaining work to a continuation message once the invocation budget runs
 * low (see invocation-budget.ts for the budget). Pure and free of Azure dependencies so use
 * cases can import it; the queue-level requeue-with-backoff helpers live in
 * function-apps/dataflows/dataflows-rate-limit.ts.
 *
 * The curve matches computeBackoffSeconds in dataflows-rate-limit.ts: the first retry waits
 * twice the base delay, doubling to the cap.
 */

export const BASE_DELAY_MS = 30_000;
export const MAX_BACKOFF_MS = 10 * 60 * 1000;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function computeNextBackoffMs(attempt: number, baseDelayMs: number): number {
  return Math.min(Math.pow(2, attempt + 1) * baseDelayMs, MAX_BACKOFF_MS);
}

export type RetryOutcome<T> = { kind: 'done'; value: T } | { kind: 'escape'; backoffMs: number };

export type RetryOptions = {
  startedAt: number;
  safeThresholdMs: number;
  baseDelayMs: number;
  onBackoff?: (attempt: number, backoffMs: number) => void;
};

/**
 * Runs one Cosmos call, sleeping and retrying in place while it is rate limited (429). Any other
 * error is rethrown to the caller. Returns `escape` instead of calling or sleeping when the
 * invocation budget cannot cover the next step, with the delay the caller should apply before
 * its continuation resumes (0 when the budget was already spent before the call).
 */
export async function retryOnRateLimit<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<RetryOutcome<T>> {
  const { startedAt, safeThresholdMs, baseDelayMs, onBackoff } = options;
  if (shouldEscape(startedAt, safeThresholdMs, 0)) {
    return { kind: 'escape', backoffMs: 0 };
  }

  let attempt = 0;
  while (true) {
    try {
      return { kind: 'done', value: await operation() };
    } catch (error) {
      if (!isTooManyRequestsError(error)) throw error;

      const backoffMs = computeNextBackoffMs(attempt, baseDelayMs);
      if (shouldEscape(startedAt, safeThresholdMs, backoffMs)) {
        return { kind: 'escape', backoffMs };
      }
      attempt++;
      onBackoff?.(attempt, backoffMs);
      await sleep(backoffMs);
    }
  }
}
