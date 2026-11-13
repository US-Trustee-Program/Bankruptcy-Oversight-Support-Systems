import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import {
  BASE_DELAY_MS,
  MAX_BACKOFF_MS,
  computeNextBackoffMs,
  retryOnRateLimit,
  sleep,
} from './dataflow-backoff';

describe('dataflow-backoff', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('computeNextBackoffMs', () => {
    test('should double from twice the base delay on each attempt', () => {
      expect(computeNextBackoffMs(0, 1000)).toEqual(2000);
      expect(computeNextBackoffMs(1, 1000)).toEqual(4000);
      expect(computeNextBackoffMs(2, 1000)).toEqual(8000);
    });

    test('should wait twice the default base delay before the first retry', () => {
      expect(computeNextBackoffMs(0, BASE_DELAY_MS)).toEqual(2 * BASE_DELAY_MS);
    });

    test('should cap at the maximum backoff', () => {
      expect(computeNextBackoffMs(20, BASE_DELAY_MS)).toEqual(MAX_BACKOFF_MS);
    });
  });

  describe('sleep', () => {
    test('should resolve after the requested delay', async () => {
      vi.useFakeTimers();
      let resolved = false;
      const pending = sleep(500).then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(499);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(resolved).toBe(true);
    });
  });

  describe('retryOnRateLimit', () => {
    const tooManyRequests = () => new TooManyRequestsError('TEST', { message: 'throttled' });
    const options = (overrides = {}) => ({
      startedAt: Date.now(),
      safeThresholdMs: 60_000,
      baseDelayMs: 10,
      ...overrides,
    });

    test('should return the operation value without waiting when it succeeds', async () => {
      const operation = vi.fn().mockResolvedValue('written');

      const outcome = await retryOnRateLimit(operation, options());

      expect(outcome).toEqual({ kind: 'done', value: 'written' });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should back off and retry after a rate limit error, reporting each backoff', async () => {
      vi.useFakeTimers();
      const operation = vi
        .fn()
        .mockRejectedValueOnce(tooManyRequests())
        .mockRejectedValueOnce(tooManyRequests())
        .mockResolvedValue('written');
      const onBackoff = vi.fn();

      const pending = retryOnRateLimit(operation, options({ onBackoff }));
      await vi.advanceTimersByTimeAsync(20);
      expect(operation).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(40);
      const outcome = await pending;

      expect(outcome).toEqual({ kind: 'done', value: 'written' });
      expect(operation).toHaveBeenCalledTimes(3);
      expect(onBackoff).toHaveBeenNthCalledWith(1, 1, 20);
      expect(onBackoff).toHaveBeenNthCalledWith(2, 2, 40);
    });

    test('should rethrow an error that is not a rate limit error', async () => {
      const failure = new Error('write failed');
      const operation = vi.fn().mockRejectedValue(failure);

      await expect(retryOnRateLimit(operation, options())).rejects.toBe(failure);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should escape instead of sleeping when the next backoff would reach the threshold', async () => {
      const operation = vi.fn().mockRejectedValue(tooManyRequests());

      const outcome = await retryOnRateLimit(
        operation,
        options({ baseDelayMs: 1000, safeThresholdMs: 1500 }),
      );

      expect(outcome).toEqual({ kind: 'escape', backoffMs: 2000 });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should escape on a later throttle once the time already spent in backoff is counted', async () => {
      vi.useFakeTimers();
      const operation = vi.fn().mockRejectedValue(tooManyRequests());

      const pending = retryOnRateLimit(
        operation,
        options({ baseDelayMs: 10, safeThresholdMs: 60 }),
      );
      await vi.advanceTimersByTimeAsync(20);
      const outcome = await pending;

      expect(outcome).toEqual({ kind: 'escape', backoffMs: 40 });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test('should escape without calling the operation when the threshold is already reached', async () => {
      const operation = vi.fn().mockResolvedValue('written');

      const outcome = await retryOnRateLimit(
        operation,
        options({ startedAt: Date.now() - 5000, safeThresholdMs: 5000 }),
      );

      expect(outcome).toEqual({ kind: 'escape', backoffMs: 0 });
      expect(operation).not.toHaveBeenCalled();
    });
  });
});
