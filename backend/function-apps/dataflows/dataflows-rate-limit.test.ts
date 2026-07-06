import { describe, test, expect, beforeEach, vi } from 'vitest';
import { StorageQueueOutput } from '@azure/functions';
import {
  handleRateLimitRetry,
  RATE_LIMIT_BASE_DELAY_SECONDS,
  RATE_LIMIT_MAX_DELAY_SECONDS,
  RATE_LIMIT_RETRY_LIMIT,
} from './dataflows-rate-limit';
import { TooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import type { ApplicationContext } from '../../lib/adapters/types/basic';

const TEST_CONNECTION_STRING = 'DefaultEndpointsProtocol=https://...';

describe('handleRateLimitRetry', () => {
  let mockDlqOutput: StorageQueueOutput;
  let mockApplicationContext: ApplicationContext;
  let mockQueueClient: { sendMessage: ReturnType<typeof vi.fn> };
  let fromConnectionStringSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockDlqOutput = {
      queueName: 'test-dlq',
    } as unknown as StorageQueueOutput;

    mockApplicationContext = {
      logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
      },
      observability: {
        startTrace: vi
          .fn()
          .mockReturnValue({ startTime: Date.now(), instanceId: 'test-id', invocationId: 'test' }),
        completeTrace: vi.fn(),
      },
      extraOutputs: {
        set: vi.fn(),
      },
    } as unknown as ApplicationContext;

    mockQueueClient = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue(mockQueueClient as never);
  });

  test('returns "not-rate-limited" when error is not a 429', async () => {
    const error = new CamsError('TEST', { message: 'Some other error' });
    const message = { retryCount: 0 };

    const result = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });

    expect(result).toBe('not-rate-limited');
  });

  test('returns "retried" and enqueues message with visibility timeout on 429 within retry limit', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { retryCount: 0 };

    const result = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });

    expect(result).toBe('retried');
    expect(fromConnectionStringSpy).toHaveBeenCalledWith(TEST_CONNECTION_STRING, 'test-check');
    expect(mockQueueClient.sendMessage).toHaveBeenCalled();
  });

  test('enqueued retry message increments retryCount', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { caseId: 'CASE-123', retryCount: 2 };

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });

    const sentMessage = JSON.parse(mockQueueClient.sendMessage.mock.calls[0]?.[0] as string);
    expect(sentMessage.retryCount).toBe(3);
  });

  test('backoff delay follows exponential formula up to cap across all retries', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const timeouts: number[] = [];

    // Exercise every retry from 0 up to (but not including) the limit.
    // At RATE_LIMIT_RETRY_LIMIT the message goes to DLQ — no retry is enqueued.
    for (
      let currentRetryCount = 0;
      currentRetryCount < RATE_LIMIT_RETRY_LIMIT;
      currentRetryCount++
    ) {
      mockQueueClient.sendMessage.mockClear();
      await handleRateLimitRetry({
        error,
        message: { retryCount: currentRetryCount },
        checkQueueName: 'test-check',
        dlqOutput: mockDlqOutput,
        context: mockApplicationContext,
        moduleName: 'TEST_MODULE',
        activityName: 'testActivity',
        connectionString: TEST_CONNECTION_STRING,
      });
      timeouts.push(mockQueueClient.sendMessage.mock.calls[0]?.[1] as number);
    }

    // Each timeout matches the formula
    for (let i = 0; i < RATE_LIMIT_RETRY_LIMIT; i++) {
      const expected = Math.min(
        2 ** (i + 1) * RATE_LIMIT_BASE_DELAY_SECONDS,
        RATE_LIMIT_MAX_DELAY_SECONDS,
      );
      expect(timeouts[i]).toBe(expected);
    }

    // Delays grow until the cap is reached
    const firstCappedIndex = timeouts.findIndex((t) => t === RATE_LIMIT_MAX_DELAY_SECONDS);
    expect(firstCappedIndex).toBeGreaterThan(0); // cap is not immediate

    // All timeouts at and after the cap equal RATE_LIMIT_MAX_DELAY_SECONDS
    for (let i = firstCappedIndex; i < RATE_LIMIT_RETRY_LIMIT; i++) {
      expect(timeouts[i]).toBe(RATE_LIMIT_MAX_DELAY_SECONDS);
    }

    // Delays strictly increase before the cap
    for (let i = 1; i < firstCappedIndex; i++) {
      expect(timeouts[i]).toBeGreaterThan(timeouts[i - 1]);
    }
  });

  test('returns "exhausted" when retryCount is exactly at RATE_LIMIT_RETRY_LIMIT (boundary)', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { retryCount: RATE_LIMIT_RETRY_LIMIT };

    const result = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });

    expect(result).toBe('exhausted');
  });

  test('returns "retried" when retryCount is one below RATE_LIMIT_RETRY_LIMIT (boundary)', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { retryCount: RATE_LIMIT_RETRY_LIMIT - 1 };

    const result = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });

    expect(result).toBe('retried');
  });

  test('returns "exhausted" and routes to DLQ when retry limit exceeded', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { caseId: 'CASE-123', retryCount: 10 };

    const result = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });

    expect(result).toBe('exhausted');
    expect(mockApplicationContext.extraOutputs.set).toHaveBeenCalledWith(
      mockDlqOutput,
      expect.arrayContaining([
        expect.objectContaining({
          type: 'QUEUE_ERROR',
          module: 'TEST_MODULE',
          activityName: 'testActivity',
          retryCount: 10,
        }),
      ]),
    );
  });

  test('DLQ message includes correlationId when provided', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { caseId: 'CASE-123', retryCount: 10 };

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      correlationId: 'CASE-456',
      connectionString: TEST_CONNECTION_STRING,
    });

    const dlqMessageArray = (
      mockApplicationContext.extraOutputs.set as ReturnType<typeof vi.fn>
    ).mock.calls.find((call: unknown[]) => (call as unknown[])[0] === mockDlqOutput)?.[1];

    expect(dlqMessageArray?.[0]).toMatchObject({
      correlationId: 'CASE-456',
    });
  });

  test('info log includes correlationId, moduleName, and visibility timeout on first retry', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { retryCount: 0 };

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      correlationId: 'CASE-999',
      connectionString: TEST_CONNECTION_STRING,
    });

    const [loggedModule, loggedMessage] = vi.mocked(mockApplicationContext.logger.info).mock
      .calls[0];
    expect(loggedModule).toBe('TEST_MODULE');
    expect(loggedMessage).toContain('CASE-999');
    expect(loggedMessage).toContain('60');
  });

  test('DLQ exhaustion entry does not include originalMessage', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { caseId: 'CASE-123', cursor: 'some-cursor', retryCount: 10 };

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });

    const dlqMessageArray = (
      mockApplicationContext.extraOutputs.set as ReturnType<typeof vi.fn>
    ).mock.calls.find((call: unknown[]) => (call as unknown[])[0] === mockDlqOutput)?.[1];

    expect(dlqMessageArray?.[0]).not.toHaveProperty('originalMessage');
  });

  test('throws when connectionString is empty string', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { retryCount: 0 };

    await expect(
      handleRateLimitRetry({
        error,
        message,
        checkQueueName: 'test-check',
        dlqOutput: mockDlqOutput,
        context: mockApplicationContext,
        moduleName: 'TEST_MODULE',
        activityName: 'testActivity',
        connectionString: '',
      }),
    ).rejects.toThrow('connectionString is required');
  });

  // NEW TESTS FOR cams-3p1f

  test('first retry (nextRetryCount === 1) logs at INFO level', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { retryCount: 0 };

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      correlationId: 'CORR-123',
      connectionString: TEST_CONNECTION_STRING,
    });

    expect(mockApplicationContext.logger.info).toHaveBeenCalled();
    const infoCall = vi.mocked(mockApplicationContext.logger.info).mock.calls[0];
    expect(infoCall[0]).toBe('TEST_MODULE');
    expect(infoCall[1]).toContain('Entering rate-limit backoff mode');
    expect(infoCall[1]).toContain('attempt 1/');
    expect(infoCall[1]).toContain('CORR-123');
    expect(infoCall[1]).toContain('TEST_MODULE');
  });

  test('second retry (nextRetryCount > 1) produces no log', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { retryCount: 1 };

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      correlationId: 'CORR-123',
      connectionString: TEST_CONNECTION_STRING,
    });

    expect(mockApplicationContext.logger.info).not.toHaveBeenCalled();
    expect(mockApplicationContext.logger.warn).not.toHaveBeenCalled();
  });

  test('exhaustion logs at ERROR with correlationId and elapsed duration', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const now = Date.now();
    const fiveSecondsAgo = new Date(now - 5000).toISOString();
    const message = { retryCount: RATE_LIMIT_RETRY_LIMIT, firstAttemptAt: fiveSecondsAgo };

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      correlationId: 'CORR-456',
      connectionString: TEST_CONNECTION_STRING,
    });

    const errorCall = vi.mocked(mockApplicationContext.logger.error).mock.calls[0];
    expect(errorCall[0]).toBe('TEST_MODULE');
    expect(errorCall[1]).toContain('CORR-456');
    expect(errorCall[1]).toContain('5'); // Elapsed around 5 seconds
  });

  test('firstAttemptAt is set on first retry', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { retryCount: 0 };

    const beforeCall = new Date();
    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });
    const afterCall = new Date();

    const sentMessage = JSON.parse(mockQueueClient.sendMessage.mock.calls[0]?.[0] as string);
    expect(sentMessage.firstAttemptAt).toBeDefined();
    const firstAttemptTime = new Date(sentMessage.firstAttemptAt);
    expect(firstAttemptTime.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(firstAttemptTime.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });

  test('firstAttemptAt is preserved on subsequent retries', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const originalFirstAttempt = new Date(Date.now() - 10000).toISOString();
    const message = { retryCount: 2, firstAttemptAt: originalFirstAttempt };

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });

    const sentMessage = JSON.parse(mockQueueClient.sendMessage.mock.calls[0]?.[0] as string);
    expect(sentMessage.firstAttemptAt).toBe(originalFirstAttempt);
  });
});
