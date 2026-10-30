import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ExportAndLoadCaseModule from '../../../lib/use-cases/dataflows/export-and-load-case';
import * as ResyncRemainingCasesModule from '../../../lib/use-cases/dataflows/resync-remaining-cases';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../../lib/common-errors/gateway-timeout';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'resync-remaining-cases',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

type CursorMessage = {
  cutoffDate: string;
  lastId: string | null;
  remainingCount: number;
  retryCount?: number;
};

describe('resync-remaining-cases handleStart', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('queues an initial cursor when cutoffDate is present', async () => {
    const { handleStart } = await import('./resync-remaining-cases');
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleStart({ cutoffDate: '2024-01-01' }, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const pageOutput = outputs.find(([key]) => key.queueName?.includes('page'));
    expect(pageOutput?.[1]).toEqual({ lastId: null, cutoffDate: '2024-01-01', remainingCount: 0 });
  });

  test('does nothing when cutoffDate is missing', async () => {
    const { handleStart } = await import('./resync-remaining-cases');
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleStart({ cutoffDate: '' }, invocationContext);

    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
  });
});

describe('resync-remaining-cases handlePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('advances the cursor and routes failures/division-changes when more cases remain', async () => {
    const { handlePage } = await import('./resync-remaining-cases');
    const cursor: CursorMessage = { cutoffDate: '2024-01-01', lastId: null, remainingCount: 0 };
    const invocationContext = makeInvocationContext();
    const okEvent: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const failedEvent: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: '001-25-00002',
      error: new CamsError('TEST', { message: 'bad' }),
    };
    const divisionChangeEvent: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: '001-25-00003',
      divisionChange: { orphanedCaseId: '081-25-00003', currentCaseId: '001-25-00003' },
    };

    vi.spyOn(
      ResyncRemainingCasesModule.default,
      'getPageOfRemainingCasesByCursor',
    ).mockResolvedValue({
      data: {
        caseIds: ['001-25-00001', '001-25-00002', '001-25-00003'],
        lastId: 'cursor-2',
        hasMore: true,
      },
    });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([
      okEvent,
      failedEvent,
      divisionChangeEvent,
    ]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handlePage(cursor, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput?.[1]).toEqual([failedEvent]);
    const fixOutput = outputs.find(([key]) => key.queueName?.includes('fix'));
    expect(fixOutput?.[1]).toEqual([divisionChangeEvent.divisionChange]);
    const pageOutput = outputs.find(([key]) => key.queueName?.includes('page'));
    expect(pageOutput?.[1]).toEqual({
      lastId: 'cursor-2',
      cutoffDate: '2024-01-01',
      remainingCount: 3,
    });
  });

  test('stops paging without queuing a next cursor when no cases remain', async () => {
    const { handlePage } = await import('./resync-remaining-cases');
    const cursor: CursorMessage = {
      cutoffDate: '2024-01-01',
      lastId: 'cursor-5',
      remainingCount: 10,
    };
    const invocationContext = makeInvocationContext();

    vi.spyOn(
      ResyncRemainingCasesModule.default,
      'getPageOfRemainingCasesByCursor',
    ).mockResolvedValue({ data: { caseIds: [], lastId: null, hasMore: false } });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handlePage(cursor, invocationContext);

    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
  });

  test('re-enqueues with backoff on a transient error from getPageOfRemainingCasesByCursor instead of throwing', async () => {
    const { handlePage } = await import('./resync-remaining-cases');
    const cursor: CursorMessage = {
      cutoffDate: '2024-01-01',
      lastId: null,
      remainingCount: 0,
      retryCount: 0,
    };
    const invocationContext = makeInvocationContext();

    vi.spyOn(
      ResyncRemainingCasesModule.default,
      'getPageOfRemainingCasesByCursor',
    ).mockResolvedValue({ error: new TooManyRequestsError('TEST') });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await expect(handlePage(cursor, invocationContext)).resolves.toBeUndefined();
    expect(mockSendMessage).toHaveBeenCalled();
  });

  test('routes to DLQ and throws when getPageOfRemainingCasesByCursor fails non-transiently', async () => {
    const { handlePage } = await import('./resync-remaining-cases');
    const cursor: CursorMessage = { cutoffDate: '2024-01-01', lastId: null, remainingCount: 0 };
    const invocationContext = makeInvocationContext();
    const nonTransientError = new CamsError('TEST', { message: 'bad query' });

    vi.spyOn(
      ResyncRemainingCasesModule.default,
      'getPageOfRemainingCasesByCursor',
    ).mockResolvedValue({ error: nonTransientError });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handlePage(cursor, invocationContext)).rejects.toThrow(nonTransientError.message);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
  });

  test('re-enqueues with backoff on a transient error from exportAndLoad instead of throwing', async () => {
    const { handlePage } = await import('./resync-remaining-cases');
    const cursor: CursorMessage = {
      cutoffDate: '2024-01-01',
      lastId: null,
      remainingCount: 0,
      retryCount: 0,
    };
    const invocationContext = makeInvocationContext();

    vi.spyOn(
      ResyncRemainingCasesModule.default,
      'getPageOfRemainingCasesByCursor',
    ).mockResolvedValue({
      data: { caseIds: ['001-25-00001'], lastId: 'cursor-1', hasMore: false },
    });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(
      new TooManyRequestsError('TEST'),
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await expect(handlePage(cursor, invocationContext)).resolves.toBeUndefined();
    expect(mockSendMessage).toHaveBeenCalled();
  });

  test('re-throws a non-429 error from exportAndLoad', async () => {
    const { handlePage } = await import('./resync-remaining-cases');
    const cursor: CursorMessage = { cutoffDate: '2024-01-01', lastId: null, remainingCount: 0 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(
      ResyncRemainingCasesModule.default,
      'getPageOfRemainingCasesByCursor',
    ).mockResolvedValue({
      data: { caseIds: ['001-25-00001'], lastId: 'cursor-1', hasMore: false },
    });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(
      new Error('Database connection failed'),
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handlePage(cursor, invocationContext)).rejects.toThrow(
      'Database connection failed',
    );
  });
});

describe('resync-remaining-cases handleError', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('abandons the event without queueing a retry when the error is a NotFoundError', async () => {
    const { handleError } = await import('./resync-remaining-cases');
    const event: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: '001-25-00001',
      error: new NotFoundError('TEST'),
    };
    const invocationContext = makeInvocationContext();

    await handleError(event, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const retryOutput = outputs.find(([key]) => key.queueName?.includes('retry'));
    expect(retryOutput).toBeUndefined();
  });

  test('clears the error and queues the event for retry when the error is not a NotFoundError', async () => {
    const { handleError } = await import('./resync-remaining-cases');
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
  });
});

describe('resync-remaining-cases handleRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    { label: 'TooManyRequestsError', build: () => new TooManyRequestsError('TEST') },
    { label: 'GatewayTimeoutError', build: () => new GatewayTimeoutError('TEST') },
  ])(
    'routes a $label to DLQ instead of throwing, preserving the manual retryCount',
    async ({ build }) => {
      const { handleRetry } = await import('./resync-remaining-cases');
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

  test('routes the event to DLQ when exportAndLoad resolves with a captured (non-transient) event.error, without throwing', async () => {
    const { handleRetry } = await import('./resync-remaining-cases');
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
    const { handleRetry } = await import('./resync-remaining-cases');
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

  test('routes to FIX when the retry detects a division change', async () => {
    const { handleRetry } = await import('./resync-remaining-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();
    const divisionChange = { orphanedCaseId: '081-25-00001', currentCaseId: '001-25-00001' };

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([
      { ...event, divisionChange },
    ]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const fixOutput = outputs.find(([key]) => key.queueName?.includes('fix'));
    expect(fixOutput).toBeDefined();
    expect(fixOutput?.[1]).toEqual([divisionChange]);
  });

  test('sets no outputs when the retry succeeds cleanly', async () => {
    const { handleRetry } = await import('./resync-remaining-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([{ ...event }]);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await handleRetry(event, invocationContext);

    expect((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).size).toBe(0);
  });

  test('re-throws a non-transient error', async () => {
    const { handleRetry } = await import('./resync-remaining-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(new Error('boom'));
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handleRetry(event, invocationContext)).rejects.toThrow('boom');
  });
});
