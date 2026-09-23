import { describe, test, expect, vi, beforeEach } from 'vitest';
import { withThrottleRetry, deleteInChunks, ThrottleRetryableCollection } from './unseed.js';

function throttleError(overrides: Record<string, unknown> = {}): Error {
  return Object.assign(new Error('Batch write error.'), { code: 16500, ...overrides });
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('withThrottleRetry', () => {
  test('returns the operation result when it succeeds on the first try', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    await expect(withThrottleRetry(operation, 'test')).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('retries on a 16500 throttling error and succeeds once it clears', async () => {
    vi.useFakeTimers();
    const operation = vi.fn().mockRejectedValueOnce(throttleError()).mockResolvedValueOnce('ok');

    const promise = withThrottleRetry(operation, 'test');
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('honors the RetryAfterMs hint instead of the computed backoff', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(throttleError({ RetryAfterMs: 1234 }))
      .mockResolvedValueOnce('ok');

    const promise = withThrottleRetry(operation, 'test');
    await vi.advanceTimersByTimeAsync(1233);
    expect(operation).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('rethrows immediately for a non-throttling error, without retrying', async () => {
    const error = new Error('boom');
    const operation = vi.fn().mockRejectedValue(error);
    await expect(withThrottleRetry(operation, 'test')).rejects.toThrow('boom');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('rethrows immediately when a non-object value is thrown, without retrying', async () => {
    const operation = vi.fn().mockRejectedValue('boom');
    await expect(withThrottleRetry(operation, 'test')).rejects.toBe('boom');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('retries when the throttling error code is a string ("16500") rather than a number', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(throttleError({ code: '16500' }))
      .mockResolvedValueOnce('ok');

    const promise = withThrottleRetry(operation, 'test');
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('falls back to computed backoff when RetryAfterMs is not positive', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(throttleError({ RetryAfterMs: 0 }))
      .mockResolvedValueOnce('ok');

    const promise = withThrottleRetry(operation, 'test');
    await vi.advanceTimersByTimeAsync(499);
    expect(operation).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test('caps the computed backoff delay at MAX_BACKOFF_MS on later retries', async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(throttleError())
      .mockRejectedValueOnce(throttleError())
      .mockRejectedValueOnce(throttleError())
      .mockRejectedValueOnce(throttleError())
      .mockRejectedValueOnce(throttleError())
      .mockRejectedValueOnce(throttleError())
      .mockResolvedValueOnce('ok');

    const promise = withThrottleRetry(operation, 'test');

    // Attempts 0-4 use uncapped backoff (500, 1000, 2000, 4000, 8000ms) - fast-forward through them.
    await vi.advanceTimersByTimeAsync(500 + 1000 + 2000 + 4000 + 8000);
    expect(operation).toHaveBeenCalledTimes(6);

    // The 6th retry (attempt 5) would compute 500 * 2^5 = 16000ms, capped to MAX_BACKOFF_MS (15000ms).
    await vi.advanceTimersByTimeAsync(14999);
    expect(operation).toHaveBeenCalledTimes(6);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(7);
  });

  test('rethrows the throttling error once retries are exhausted', async () => {
    vi.useFakeTimers();
    const error = throttleError();
    const operation = vi.fn().mockRejectedValue(error);

    const promise = withThrottleRetry(operation, 'test');
    const timersFlushed = vi.runAllTimersAsync();
    await expect(promise).rejects.toBe(error);
    await timersFlushed;

    // 1 initial attempt + 8 retries (MAX_THROTTLE_RETRIES)
    expect(operation).toHaveBeenCalledTimes(9);
  });
});

describe('deleteInChunks', () => {
  function fakeCollection(batches: { _id: unknown }[][]): ThrottleRetryableCollection {
    let call = 0;
    return {
      find: vi.fn().mockImplementation(() => ({
        limit: () => ({
          toArray: async () => batches[call++] ?? [],
        }),
      })),
      deleteMany: vi.fn().mockImplementation(async (filter: Record<string, unknown>) => {
        const ids = (filter['_id'] as { $in: unknown[] } | undefined)?.$in ?? [];
        return { deletedCount: ids.length };
      }),
    };
  }

  test('deletes matching documents in bounded batches until none remain', async () => {
    const collection = fakeCollection([[{ _id: 'a' }, { _id: 'b' }], [{ _id: 'c' }], []]);

    const total = await deleteInChunks(collection, { id: { $regex: '^seed-' } }, 'cases');

    expect(total).toBe(3);
    expect(collection.deleteMany).toHaveBeenCalledTimes(2);
    expect(collection.deleteMany).toHaveBeenNthCalledWith(1, { _id: { $in: ['a', 'b'] } });
    expect(collection.deleteMany).toHaveBeenNthCalledWith(2, { _id: { $in: ['c'] } });
    expect(collection.find).toHaveBeenCalledWith(
      { id: { $regex: '^seed-' } },
      { projection: { _id: 1 } },
    );
  });

  test('returns 0 without issuing a delete when nothing matches', async () => {
    const collection = fakeCollection([[]]);
    const total = await deleteInChunks(collection, {}, 'trustee-variation');
    expect(total).toBe(0);
    expect(collection.deleteMany).not.toHaveBeenCalled();
  });

  test('retries a throttled batch delete and still makes progress', async () => {
    vi.useFakeTimers();
    const collection = fakeCollection([[{ _id: 'a' }], []]);
    collection.deleteMany = vi
      .fn()
      .mockRejectedValueOnce(throttleError())
      .mockResolvedValueOnce({ deletedCount: 1 });

    const promise = deleteInChunks(collection, {}, 'cases');
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe(1);
    expect(collection.deleteMany).toHaveBeenCalledTimes(2);
  });

  test('retries a throttled find and still makes progress', async () => {
    vi.useFakeTimers();
    let findCall = 0;
    const collection: ThrottleRetryableCollection = {
      find: vi.fn().mockImplementation(() => ({
        limit: () => ({
          toArray: async () => {
            findCall += 1;
            if (findCall === 1) throw throttleError();
            return findCall === 2 ? [{ _id: 'a' }] : [];
          },
        }),
      })),
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    };

    const promise = deleteInChunks(collection, {}, 'cases');
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe(1);
    expect(collection.find).toHaveBeenCalledTimes(3);
    expect(collection.deleteMany).toHaveBeenCalledTimes(1);
  });
});
