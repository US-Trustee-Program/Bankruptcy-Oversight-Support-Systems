import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { InvocationContext, StorageQueueOutput } from '@azure/functions';
import { handleRateLimitRetry } from './dataflows-rate-limit';
import { TooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import * as telemetryModule from '../../lib/use-cases/dataflows/dataflow-telemetry';
import * as queueTypesModule from '../../lib/use-cases/dataflows/queue-types';

describe('handleRateLimitRetry', () => {
  let mockInvocationContext: InvocationContext;
  let mockDlqOutput: StorageQueueOutput;
  let mockApplicationContext: {
    logger: {
      error: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      info: ReturnType<typeof vi.fn>;
    };
    observability: { startTrace: ReturnType<typeof vi.fn> };
  };
  let mockQueueClient: { sendMessage: ReturnType<typeof vi.fn> };
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalEnv = { ...process.env };
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://...';

    mockInvocationContext = {
      extraOutputs: {
        set: vi.fn(),
      },
      invocationId: 'test-invocation-id',
    } as unknown as InvocationContext;

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
    };

    mockQueueClient = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue(mockQueueClient);
    vi.spyOn(telemetryModule, 'completeDataflowTrace').mockImplementation(() => {});
    vi.spyOn(queueTypesModule, 'buildQueueError').mockImplementation(
      (error) =>
        ({
          type: 'QUEUE_ERROR',
          module: 'TEST_MODULE',
          error,
        }) as unknown as ReturnType<typeof queueTypesModule.buildQueueError>,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('returns "not-rate-limited" when error is not a 429', async () => {
    const error = new CamsError('TEST', { message: 'Some other error' });
    const message = { retryCount: 0 };

    const result = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      invocationContext: mockInvocationContext,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
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
      invocationContext: mockInvocationContext,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
    });

    expect(result).toBe('retried');
    expect(vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString')).toHaveBeenCalledWith(
      process.env.AzureWebJobsDataflowsStorage,
      'test-check',
    );
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
      invocationContext: mockInvocationContext,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
    });

    const sentMessage = JSON.parse(mockQueueClient.sendMessage.mock.calls[0]?.[0] as string);
    expect(sentMessage.retryCount).toBe(3);
  });

  test('backoff delay increases with each retry', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });

    // First retry (retryCount 0 -> 1): 2^0 * 30 = 30s
    const message1 = { retryCount: 0 };
    await handleRateLimitRetry({
      error,
      message: message1,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      invocationContext: mockInvocationContext,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
    });
    const timeout1 = mockQueueClient.sendMessage.mock.calls[0]?.[1];

    // Second retry (retryCount 1 -> 2): 2^1 * 30 = 60s
    mockQueueClient.sendMessage.mockClear();
    const message2 = { retryCount: 1 };
    await handleRateLimitRetry({
      error,
      message: message2,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      invocationContext: mockInvocationContext,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
    });
    const timeout2 = mockQueueClient.sendMessage.mock.calls[0]?.[1];

    expect(timeout2).toBeGreaterThan(timeout1);
    expect(timeout1).toBe(30);
    expect(timeout2).toBe(60);
  });

  test('returns "exhausted" and routes to DLQ when retry limit exceeded', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { caseId: 'CASE-123', retryCount: 10 };

    vi.spyOn(queueTypesModule, 'buildQueueError').mockReturnValueOnce({
      type: 'QUEUE_ERROR',
      module: 'TEST_MODULE',
      activityName: 'testActivity',
      error,
    } as unknown as ReturnType<typeof queueTypesModule.buildQueueError>);

    const result = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      invocationContext: mockInvocationContext,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
    });

    expect(result).toBe('exhausted');
    expect(mockInvocationContext.extraOutputs.set).toHaveBeenCalledWith(
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

    vi.spyOn(queueTypesModule, 'buildQueueError').mockReturnValueOnce({
      type: 'QUEUE_ERROR',
      module: 'TEST_MODULE',
      activityName: 'testActivity',
      error,
    } as unknown as ReturnType<typeof queueTypesModule.buildQueueError>);

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      invocationContext: mockInvocationContext,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
      correlationId: 'CASE-456',
    });

    const dlqMessageArray = mockInvocationContext.extraOutputs.set.mock.calls.find(
      (call: unknown[]) => (call as unknown[])[0] === mockDlqOutput,
    )?.[1];

    expect(dlqMessageArray?.[0]).toMatchObject({
      correlationId: 'CASE-456',
    });
  });

  test('emits completeDataflowTrace with success false on exhaustion', async () => {
    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { caseId: 'CASE-123', retryCount: 10 };

    vi.spyOn(queueTypesModule, 'buildQueueError').mockReturnValueOnce({
      type: 'QUEUE_ERROR',
      module: 'TEST_MODULE',
      activityName: 'testActivity',
      error,
    } as unknown as ReturnType<typeof queueTypesModule.buildQueueError>);

    await handleRateLimitRetry({
      error,
      message,
      checkQueueName: 'test-check',
      dlqOutput: mockDlqOutput,
      invocationContext: mockInvocationContext,
      context: mockApplicationContext,
      moduleName: 'TEST_MODULE',
      activityName: 'testActivity',
    });

    expect(telemetryModule.completeDataflowTrace).toHaveBeenCalledWith(
      mockApplicationContext.observability,
      expect.any(Object),
      'TEST_MODULE',
      'testActivity',
      mockApplicationContext.logger,
      expect.objectContaining({
        success: false,
      }),
    );
  });

  test('throws when AzureWebJobsDataflowsStorage env var is missing', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;

    const error = new TooManyRequestsError('TEST', { message: 'Rate limited' });
    const message = { retryCount: 0 };

    await expect(
      handleRateLimitRetry({
        error,
        message,
        checkQueueName: 'test-check',
        dlqOutput: mockDlqOutput,
        invocationContext: mockInvocationContext,
        context: mockApplicationContext,
        moduleName: 'TEST_MODULE',
        activityName: 'testActivity',
      }),
    ).rejects.toThrow('Missing required environment variable: AzureWebJobsDataflowsStorage');
  });
});
