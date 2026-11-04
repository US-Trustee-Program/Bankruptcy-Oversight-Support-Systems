import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ExportAndLoadCaseModule from '../../../lib/use-cases/dataflows/export-and-load-case';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import SyncCases from '../../../lib/use-cases/dataflows/sync-cases';
import CasesRuntimeState from '../../../lib/use-cases/dataflows/cases-runtime-state';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CaseSyncEvent } from '@common/cams/dataflow-events';
import MockData from '@common/cams/test-utilities/mock-data';
import { buildQueueName } from '../dataflows-common';
import { RATE_LIMIT_RETRY_LIMIT } from '../dataflows-rate-limit';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'sync-cases',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeCaseSyncEvent = (caseId: string): CaseSyncEvent =>
  ({
    type: 'CASE_CHANGED',
    caseId,
  }) as CaseSyncEvent;

describe('sync-cases handlePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process events and emit telemetry on success', async () => {
    const { handlePage } = await import('./sync-cases');
    const events = [makeCaseSyncEvent('001-25-00001'), makeCaseSyncEvent('001-25-00002')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    const processedEvents = events.map((e) => ({
      ...e,
      error: undefined,
      divisionChange: undefined,
    }));
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue(
      processedEvents as Awaited<ReturnType<typeof ExportAndLoadCaseModule.default.exportAndLoad>>,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(ExportAndLoadCaseModule.default.exportAndLoad).toHaveBeenCalledWith(
      expect.anything(),
      events,
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 2, documentsFailed: 0 }),
    );
  });

  test('should re-enqueue with backoff and emit rate-limited-requeued telemetry on 429', async () => {
    const { handlePage } = await import('./sync-cases');
    const events = [makeCaseSyncEvent('001-25-00001')];
    const message = { events, retryCount: 0 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(mockSendMessage).toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted, keeping only type and caseId of each event', async () => {
    const { handlePage } = await import('./sync-cases');
    const events = [makeCaseSyncEvent('001-25-00001')];
    const message = { events, retryCount: RATE_LIMIT_RETRY_LIMIT };
    const invocationContext = makeInvocationContext();

    const bCase = MockData.getDxtrCase();
    bCase.debtor.name = 'REDACTION-PROBE';
    const tooManyError = new TooManyRequestsError('SYNC-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockImplementation(
      async (_context, pageEvents) => {
        pageEvents[0].bCase = bCase;
        throw tooManyError;
      },
    );
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
    const dlqCall = extraOutputsSetSpy.mock.calls.find(([output]) =>
      (output as { queueName: string }).queueName.includes('dlq'),
    );
    const [dlqEntry] = dlqCall?.[1] as { message: { events: unknown } }[];
    expect(dlqEntry.message.events).toEqual([{ type: 'CASE_CHANGED', caseId: '001-25-00001' }]);
    expect(JSON.stringify(dlqEntry)).not.toContain('REDACTION-PROBE');

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
    );
  });

  test('should re-throw on non-429 error', async () => {
    const { handlePage } = await import('./sync-cases');
    const events = [makeCaseSyncEvent('001-25-00001')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    const error = new CamsError('SYNC-CASES', { message: 'Database connection failed' });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(error);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handlePage(message, invocationContext)).rejects.toThrow(
      'Database connection failed',
    );
  });
});

describe('sync-cases handleStart', () => {
  const PAGE_QUEUE = buildQueueName('SYNC-CASES', 'page');
  const START_QUEUE = buildQueueName('SYNC-CASES', 'start');

  beforeEach(() => {
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  async function setupMocks(eventCount = 2) {
    const events = Array.from({ length: eventCount }, (_, index) =>
      makeCaseSyncEvent(`001-25-${String(index + 1).padStart(5, '0')}`),
    );
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(SyncCases, 'getCaseIds').mockResolvedValue({
      events,
      lastCasesSyncDate: '2026-10-01T00:00:00Z',
      lastTransactionsSyncDate: '2026-10-02T00:00:00Z',
    });
    const storeRuntimeStateSpy = vi
      .spyOn(CasesRuntimeState, 'storeRuntimeState')
      .mockResolvedValue(undefined);

    const sendByQueue: Record<string, ReturnType<typeof vi.fn>> = {
      [PAGE_QUEUE]: vi.fn().mockResolvedValue(undefined),
      [START_QUEUE]: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockImplementation(
      (_connectionString, queueName) => {
        if (!(queueName in sendByQueue)) {
          throw new Error(`unexpected queue ${queueName}`);
        }
        return { sendMessage: sendByQueue[queueName] } as unknown as StorageQueueHumbleObject;
      },
    );
    return {
      events,
      mockContext,
      storeRuntimeStateSpy,
      pageSend: sendByQueue[PAGE_QUEUE],
      startSend: sendByQueue[START_QUEUE],
    };
  }

  function getDlqOutput(invocationContext: InvocationContext) {
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    return outputs.find(([key]) => key.queueName?.includes('dlq'));
  }

  function sentBodies(send: { mock: { calls: unknown[][] } }) {
    return send.mock.calls.map(([body]) => JSON.parse(body as string));
  }

  test('should send pages to the page queue and store runtime state', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { events, pageSend, startSend, storeRuntimeStateSpy } = await setupMocks();

    await handleStart({}, invocationContext);

    expect(sentBodies(pageSend)).toEqual([{ events }]);
    expect(sentBodies(startSend)).toEqual([]);
    expect(getDlqOutput(invocationContext)).toBeUndefined();
    expect(storeRuntimeStateSpy).toHaveBeenCalledWith(
      expect.anything(),
      '2026-10-01T00:00:00Z',
      '2026-10-02T00:00:00Z',
    );
  });

  test('should report success false and route to DLQ when storing runtime state fails after all pages are queued', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { events, pageSend, storeRuntimeStateSpy } = await setupMocks();
    storeRuntimeStateSpy.mockRejectedValue(new Error('watermark upsert failed'));
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, invocationContext);

    expect(sentBodies(pageSend)).toEqual([{ events }]);
    expect(getDlqOutput(invocationContext)).toBeDefined();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-CASES',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: false }),
    );
  });

  test('should requeue the start message with backoff and send no pages when getCaseIds is throttled', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { pageSend, startSend, storeRuntimeStateSpy } = await setupMocks();
    vi.spyOn(SyncCases, 'getCaseIds').mockRejectedValue(new TooManyRequestsError('SYNC-CASES'));
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, invocationContext);

    expect(sentBodies(pageSend)).toEqual([]);
    expect(sentBodies(startSend)).toEqual([{ retryCount: 1, firstAttemptAt: expect.any(String) }]);
    expect(storeRuntimeStateSpy).not.toHaveBeenCalled();
    expect(getDlqOutput(invocationContext)).toBeUndefined();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-CASES',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should keep lastSyncDate on the requeued start message when getCaseIds is throttled', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { startSend } = await setupMocks();
    vi.spyOn(SyncCases, 'getCaseIds').mockRejectedValue(new TooManyRequestsError('SYNC-CASES'));

    await handleStart({ lastSyncDate: '2024-01-01' }, invocationContext);

    expect(sentBodies(startSend)).toEqual([
      { lastSyncDate: '2024-01-01', retryCount: 1, firstAttemptAt: expect.any(String) },
    ]);
  });

  test('should requeue the start message without a DLQ entry when the runtime state write is throttled after pages are queued', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { events, pageSend, startSend, storeRuntimeStateSpy } = await setupMocks();
    storeRuntimeStateSpy.mockRejectedValue(new TooManyRequestsError('CASE-RUNTIME-STATE'));

    await handleStart({}, invocationContext);

    expect(sentBodies(pageSend)).toEqual([{ events }]);
    expect(sentBodies(startSend)).toEqual([{ retryCount: 1, firstAttemptAt: expect.any(String) }]);
    expect(getDlqOutput(invocationContext)).toBeUndefined();
  });

  test('should write the start message to the DLQ without rethrowing when the throttle retry limit is exhausted', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { mockContext, pageSend, startSend } = await setupMocks();
    vi.spyOn(SyncCases, 'getCaseIds').mockRejectedValue(new TooManyRequestsError('SYNC-CASES'));
    const contextExtraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await expect(
      handleStart({ retryCount: RATE_LIMIT_RETRY_LIMIT }, invocationContext),
    ).resolves.toBeUndefined();

    expect(sentBodies(pageSend)).toEqual([]);
    expect(sentBodies(startSend)).toEqual([]);
    expect(contextExtraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: buildQueueName('SYNC-CASES', 'dlq') }),
      expect.anything(),
    );
    expect(getDlqOutput(invocationContext)).toBeUndefined();
    expect(telemetrySpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-CASES',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
    );
  });

  test('should route a throttled context creation to the DLQ without sending to any queue', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { pageSend, startSend } = await setupMocks();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockRejectedValue(
      new TooManyRequestsError('SYNC-CASES'),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, invocationContext);

    expect(sentBodies(pageSend)).toEqual([]);
    expect(sentBodies(startSend)).toEqual([]);
    expect(getDlqOutput(invocationContext)).toBeDefined();
    expect(telemetrySpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-CASES',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: false }),
    );
  });

  test('should split 201 events into pages of at most 100 and deliver each event exactly once', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { events, pageSend, storeRuntimeStateSpy } = await setupMocks(201);

    await handleStart({}, invocationContext);

    const pages: { events: CaseSyncEvent[] }[] = sentBodies(pageSend);
    expect(Math.max(...pages.map((page) => page.events.length))).toBeLessThanOrEqual(100);
    const deliveredCaseIds = pages.flatMap((page) => page.events.map((event) => event.caseId));
    expect(deliveredCaseIds.sort()).toEqual(events.map((event) => event.caseId).sort());
    expect(storeRuntimeStateSpy).toHaveBeenCalledWith(
      expect.anything(),
      '2026-10-01T00:00:00Z',
      '2026-10-02T00:00:00Z',
    );
  });

  test('should stop at the first failed page, never send later pages, and not store runtime state', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { events, pageSend, storeRuntimeStateSpy } = await setupMocks(201);
    pageSend.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('queue unavailable'));
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, invocationContext);

    expect(storeRuntimeStateSpy).not.toHaveBeenCalled();
    expect(getDlqOutput(invocationContext)).toBeDefined();
    expect(telemetrySpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-CASES',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: false }),
    );
    const page3CaseIds = events.slice(200).map((event) => event.caseId);
    const sentCaseIds = sentBodies(pageSend).flatMap((page: { events: CaseSyncEvent[] }) =>
      page.events.map((event) => event.caseId),
    );
    expect(sentCaseIds.some((caseId) => page3CaseIds.includes(caseId))).toBe(false);
  });
});

describe('sync-cases handlePagePoison', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should log error, write to DLQ, and emit telemetry with success:false', async () => {
    const { handlePagePoison } = await import('./sync-cases');
    const message = { events: [{ type: 'CASE_CHANGED', caseId: '001-25-00001' }] };
    const invocationContext = makeInvocationContext();

    const mockContext = await createMockApplicationContext();
    const logSpy = vi.spyOn(mockContext.logger, 'error');

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePagePoison(message as Record<string, unknown>, invocationContext);

    expect(logSpy).toHaveBeenCalledWith('SYNC-CASES', expect.stringContaining('Poison message'));

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();
    const dlqMessage = dlqOutput?.[1] as unknown[];
    expect(dlqMessage?.[0]).toHaveProperty('type', 'QUEUE_ERROR');

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-CASES',
      'handlePagePoison',
      expect.anything(),
      expect.objectContaining({ success: false, documentsFailed: 1, error: 'poison-message' }),
    );
  });
});
