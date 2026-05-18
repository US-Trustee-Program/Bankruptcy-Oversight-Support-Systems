import { describe, test, expect, beforeEach, vi } from 'vitest';
import { StorageQueueOutput } from '@azure/functions';
import { handleRateLimitRetry } from './dataflows-rate-limit';
import { TooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import * as queueTypesModule from '../../lib/use-cases/dataflows/queue-types';
import type { ApplicationContext } from '../../lib/adapters/types/basic';

const TEST_CONNECTION_STRING = 'DefaultEndpointsProtocol=https://...';

describe('handleRateLimitRetry', () => {
  let mockDlqOutput: StorageQueueOutput;
  let mockApplicationContext: ApplicationContext;
  let mockQueueClient: { sendMessage: ReturnType<typeof vi.fn> };
  let fromConnectionStringSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();

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
        startTrace: vi.fn().mockReturnValue({ startTime: Date.now(), instanceId: 'test-id' }),
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
    vi.spyOn(queueTypesModule, 'buildQueueError').mockImplementation(
      (error) =>
        ({
          type: 'QUEUE_ERROR',
          module: 'TEST_MODULE',
          error,
        }) as unknown as ReturnType<typeof queueTypesModule.buildQueueError>,
    );
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
    expect(vi.mocked(mockApplicationContext.observability.startTrace)).not.toHaveBeenCalled();
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

  test('backoff delay increases with each retry', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });

    // First retry (retryCount 0 -> 1): 2^1 * 30 = 60s (using nextRetryCount for backoff)
    const message1 = { retryCount: 0 };
    await handleRateLimitRetry({
      error,
      message: message1,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });
    const timeout1 = mockQueueClient.sendMessage.mock.calls[0]?.[1];

    // Second retry (retryCount 1 -> 2): 2^2 * 30 = 120s (using nextRetryCount for backoff)
    mockQueueClient.sendMessage.mockClear();
    const message2 = { retryCount: 1 };
    await handleRateLimitRetry({
      error,
      message: message2,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      connectionString: TEST_CONNECTION_STRING,
    });
    const timeout2 = mockQueueClient.sendMessage.mock.calls[0]?.[1];

    expect(timeout2).toBeGreaterThan(timeout1);
    // Backoff formula: Math.min(2^nextRetryCount * BASE_DELAY_SECONDS, MAX_DELAY_SECONDS)
    // BASE_DELAY_SECONDS = 30, so: retryCount 0 -> nextRetryCount 1 → 2^1 * 30 = 60s,
    //                              retryCount 1 -> nextRetryCount 2 → 2^2 * 30 = 120s
    expect(timeout1).toBe(60);
    expect(timeout2).toBe(120);
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

  test('warning log includes correlationId, moduleName, and visibility timeout on retry', async () => {
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

    const [loggedModule, loggedMessage] = vi.mocked(mockApplicationContext.logger.warn).mock
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
});
