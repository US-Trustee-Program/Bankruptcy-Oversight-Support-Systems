import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ExportAndLoadCaseModule from '../../../lib/use-cases/dataflows/export-and-load-case';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'resync-terminal-transaction-cases',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeCaseSyncEvent = (caseId: string): CaseSyncEvent =>
  ({
    type: 'CASE_CHANGED',
    caseId,
  }) as CaseSyncEvent;

describe('resync-terminal-transaction-cases handlePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process events successfully and not set DLQ output', async () => {
    const { handlePage } = await import('./resync-terminal-transaction-cases');
    const events = [makeCaseSyncEvent('001-25-00001'), makeCaseSyncEvent('001-25-00002')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue(events);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handlePage(message, invocationContext);

    expect(ExportAndLoadCaseModule.default.exportAndLoad).toHaveBeenCalledWith(
      expect.anything(),
      events,
    );

    // No DLQ output should be set when no events have errors
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeUndefined();
  });

  test('should re-enqueue to PAGE queue with backoff on 429 error', async () => {
    const { handlePage } = await import('./resync-terminal-transaction-cases');
    const events = [makeCaseSyncEvent('001-25-00001')];
    const message = { events, retryCount: 0 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('RESYNC-TERMINAL-TRANSACTION-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    expect(mockSendMessage).toHaveBeenCalled();
    // Verify it was sent to the PAGE queue (not RETRY queue)
    const [, queueName] = vi.mocked(StorageQueueHumbleObject.fromConnectionString).mock
      .calls[0] as [string, string];
    expect(queueName).toContain('page');
  });

  test('should route to DLQ when 429 retry limit is exhausted', async () => {
    const { handlePage } = await import('./resync-terminal-transaction-cases');
    const events = [makeCaseSyncEvent('001-25-00001')];
    const message = { events, retryCount: 10 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('RESYNC-TERMINAL-TRANSACTION-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handlePage(message, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
  });

  test('should rethrow on non-429 error', async () => {
    const { handlePage } = await import('./resync-terminal-transaction-cases');
    const events = [makeCaseSyncEvent('001-25-00001')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    const error = new CamsError('RESYNC-TERMINAL-TRANSACTION-CASES', {
      message: 'Database error',
    });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(error);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handlePage(message, invocationContext)).rejects.toThrow('Database error');
  });
});

describe('resync-terminal-transaction-cases handleRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process a retry event successfully', async () => {
    const { handleRetry } = await import('./resync-terminal-transaction-cases');
    const event = makeCaseSyncEvent('001-25-00001');
    event.retryCount = 1;
    const invocationContext = makeInvocationContext();

    const processedEvent = { ...event };
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([processedEvent]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    expect(ExportAndLoadCaseModule.default.exportAndLoad).toHaveBeenCalledWith(expect.anything(), [
      event,
    ]);

    // No DLQ output on success
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeUndefined();
  });

  test('should re-enqueue to RETRY queue with backoff on 429 error', async () => {
    const { handleRetry } = await import('./resync-terminal-transaction-cases');
    const event = makeCaseSyncEvent('001-25-00001');
    event.retryCount = 1;
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('RESYNC-TERMINAL-TRANSACTION-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handleRetry(event, invocationContext);

    expect(mockSendMessage).toHaveBeenCalled();
    // Verify it was sent to the RETRY queue
    const [, queueName] = vi.mocked(StorageQueueHumbleObject.fromConnectionString).mock
      .calls[0] as [string, string];
    expect(queueName).toContain('retry');
  });

  test('should route to DLQ when 429 retry limit is exhausted for handleRetry', async () => {
    const RateLimitModule = await import('../dataflows-rate-limit');
    const { handleRetry } = await import('./resync-terminal-transaction-cases');

    // event.retryCount=1 is below the RETRY_LIMIT=3 so incrementRetryCount lets it pass.
    // We then simulate the rate-limit retry counter being exhausted by mocking handleRateLimitRetry.
    const event = makeCaseSyncEvent('001-25-00001');
    event.retryCount = 1;
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('RESYNC-TERMINAL-TRANSACTION-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(RateLimitModule, 'handleRateLimitRetry').mockImplementation(
      async ({ dlqOutput, invocationContext: ctx }) => {
        ctx.extraOutputs.set(dlqOutput, [{ error: 'rate-limit-retry-exhausted' }]);
        return 'exhausted';
      },
    );

    await handleRetry(event, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
  });
});
