import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ExportAndLoadCaseModule from '../../../lib/use-cases/dataflows/export-and-load-case';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
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
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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
    vi.restoreAllMocks();
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
    expect(mockSendMessage).toHaveBeenCalled();
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
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test.each([{ label: 'TooManyRequestsError', build: () => new TooManyRequestsError('TEST') }])(
    'routes a $label to DLQ instead of throwing, preserving the manual retryCount',
    async ({ build }) => {
      const { handleRetry } = await import('./resync-terminal-transaction-cases');
      const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
      const invocationContext = makeInvocationContext();

      vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(build());
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );

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
    },
  );

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
