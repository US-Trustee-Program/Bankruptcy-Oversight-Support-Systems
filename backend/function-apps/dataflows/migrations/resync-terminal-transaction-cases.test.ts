import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ExportAndLoadCaseModule from '../../../lib/use-cases/dataflows/export-and-load-case';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../../lib/common-errors/gateway-timeout';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as ResyncTerminalTransactionCasesModule from '../../../lib/use-cases/dataflows/resync-terminal-transaction-cases';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'resync-terminal-transaction-cases',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

type PageMessage = { events: CaseSyncEvent[]; retryCount?: number };

describe('resync-terminal-transaction-cases handleStart', () => {
  test('should queue pages wrapped with an events property', async () => {
    const { handleStart } = (await import('./resync-terminal-transaction-cases')) as unknown as {
      handleStart: (message: { cutoffDate?: string }, context: InvocationContext) => Promise<void>;
    };
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];

    vi.spyOn(
      ResyncTerminalTransactionCasesModule.default,
      'getCaseIdsWithBlindSpot',
    ).mockResolvedValue({ events, error: undefined });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const invocationContext = makeInvocationContext();

    await handleStart({ cutoffDate: '2018-01-01' }, invocationContext);

    const queued = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    ).find(([key]) => key.queueName?.includes('page'));
    expect(queued).toBeDefined();
    const pages = queued?.[1] as PageMessage[];
    expect(pages[0]).toEqual({ events });
  });
});

describe('resync-terminal-transaction-cases handlePage', () => {
  beforeEach(() => {
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process events and send failures to DLQ', async () => {
    const { handlePage } = await import('./resync-terminal-transaction-cases');
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];
    const message: PageMessage = { events };
    const invocationContext = makeInvocationContext();
    const failedEvent = { ...events[0], error: new CamsError('TEST', { message: 'bad' }) };

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([failedEvent]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handlePage(message, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
    expect(dlqOutput?.[1]).toEqual([failedEvent]);
  });

  test('accepts a bare CaseSyncEvent[] queued by a pre-deploy version of this function', async () => {
    const { handlePage } = await import('./resync-terminal-transaction-cases');
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([events[0]]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handlePage(events, invocationContext);

    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
  });

  test('should re-enqueue with backoff on a transient error instead of throwing', async () => {
    const { handlePage } = await import('./resync-terminal-transaction-cases');
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];
    const message: PageMessage = { events, retryCount: 0 };
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

    await expect(handlePage(message, invocationContext)).resolves.toBeUndefined();
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [sentBody, visibilityTimeout] = mockSendMessage.mock.calls[0];
    expect(JSON.parse(sentBody)).toEqual(
      expect.objectContaining({
        events,
        retryCount: 1,
        firstAttemptAt: expect.any(String),
      }),
    );
    expect(visibilityTimeout).toBeGreaterThan(0);
    expect(visibilityTimeout).toBeLessThanOrEqual(600);
  });

  test('should route to DLQ instead of throwing when retry limit exhausted', async () => {
    const { handlePage } = await import('./resync-terminal-transaction-cases');
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];
    const message: PageMessage = { events, retryCount: 10 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('RESYNC-TERMINAL-TRANSACTION-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(tooManyError);
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await expect(handlePage(message, invocationContext)).resolves.toBeUndefined();
    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
  });

  test('should re-throw on non-429 error', async () => {
    const { handlePage } = await import('./resync-terminal-transaction-cases');
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];
    const message: PageMessage = { events };
    const invocationContext = makeInvocationContext();

    const error = new CamsError('RESYNC-TERMINAL-TRANSACTION-CASES', {
      message: 'Database connection failed',
    });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(error);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handlePage(message, invocationContext)).rejects.toThrow(
      'Database connection failed',
    );
  });
});

describe('resync-terminal-transaction-cases handleRetry', () => {
  test.each([
    { label: 'TooManyRequestsError', build: () => new TooManyRequestsError('TEST') },
    { label: 'GatewayTimeoutError', build: () => new GatewayTimeoutError('TEST') },
  ])(
    'routes a $label to DLQ instead of throwing, preserving the manual retryCount',
    async ({ build }) => {
      const { handleRetry } = await import('./resync-terminal-transaction-cases');
      const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
      const invocationContext = makeInvocationContext();

      vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(build());
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const warnSpy = vi.spyOn(mockContext.logger, 'warn');

      await handleRetry(event, invocationContext);

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeDefined();
      const [dlqEvent] = dlqOutput?.[1] as CaseSyncEvent[];
      expect(dlqEvent.error).toBeDefined();
      expect(dlqEvent.retryCount).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        'RESYNC-TERMINAL-TRANSACTION-CASES',
        expect.stringContaining(event.caseId),
      );
    },
  );

  test('routes the event to DLQ when exportAndLoad resolves with a captured (non-transient) event.error, without throwing', async () => {
    const { handleRetry } = await import('./resync-terminal-transaction-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();
    const camsError = new CamsError('TEST', { message: 'case sync failed' });

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([
      { ...event, error: camsError },
    ]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
    const [dlqEvent] = dlqOutput?.[1] as CaseSyncEvent[];
    expect(dlqEvent.error).toBe(camsError);
  });

  test('routes to HARD_STOP without calling exportAndLoad once the retry limit is exceeded', async () => {
    const { handleRetry } = await import('./resync-terminal-transaction-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001', retryCount: 3 };
    const invocationContext = makeInvocationContext();

    const exportAndLoadSpy = vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    expect(exportAndLoadSpy).not.toHaveBeenCalled();
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const hardStopOutput = outputs.find(([key]) => key.queueName?.includes('hard-stop'));
    expect(hardStopOutput).toBeDefined();
    const [hardStopEvent] = hardStopOutput?.[1] as CaseSyncEvent[];
    expect(hardStopEvent.retryCount).toBe(4);
  });

  test('logs success and sets no outputs when the retry succeeds', async () => {
    const { handleRetry } = await import('./resync-terminal-transaction-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([{ ...event }]);
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const infoSpy = vi.spyOn(mockContext.logger, 'info');

    await handleRetry(event, invocationContext);

    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
    expect(infoSpy).toHaveBeenCalledWith(
      'RESYNC-TERMINAL-TRANSACTION-CASES',
      expect.stringContaining('Successfully retried'),
    );
  });

  test('re-throws a non-transient error', async () => {
    const { handleRetry } = await import('./resync-terminal-transaction-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(new Error('boom'));
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handleRetry(event, invocationContext)).rejects.toThrow('boom');
  });
});

describe('resync-terminal-transaction-cases handleError', () => {
  test('abandons the event without queueing a retry when the error is a NotFoundError', async () => {
    const { handleError } = await import('./resync-terminal-transaction-cases');
    const event: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: '001-25-00001',
      error: new NotFoundError('TEST'),
    };
    const invocationContext = makeInvocationContext();

    await handleError(event, invocationContext);

    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
    expect(invocationContext.log).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('Abandoning attempt')]),
    );
  });

  test('clears the error and queues the event for retry when the error is not a NotFoundError', async () => {
    const { handleError } = await import('./resync-terminal-transaction-cases');
    const event: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: '001-25-00001',
      error: new CamsError('TEST', { message: 'transient failure' }),
    };
    const invocationContext = makeInvocationContext();

    await handleError(event, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const retryOutput = outputs.find(([key]) => key.queueName?.includes('retry'));
    expect(retryOutput).toBeDefined();
    const [retryEvent] = retryOutput?.[1] as CaseSyncEvent[];
    expect(retryEvent.error).toBeUndefined();
    expect(retryEvent.caseId).toBe(event.caseId);
  });
});
