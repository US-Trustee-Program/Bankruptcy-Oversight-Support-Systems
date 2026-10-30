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

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handlePage } = await import('./sync-cases');
    const events = [makeCaseSyncEvent('001-25-00001')];
    const message = { events, retryCount: 10 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(tooManyError);
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );

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
  beforeEach(() => {
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  async function setupMocks(eventCount = 2) {
    const events = Array.from({ length: eventCount }, (_, index) =>
      makeCaseSyncEvent(`001-25-${String(index + 1).padStart(5, '0')}`),
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(SyncCases, 'getCaseIds').mockResolvedValue({
      events,
      lastCasesSyncDate: '2026-10-01T00:00:00Z',
      lastTransactionsSyncDate: '2026-10-02T00:00:00Z',
    });
    const storeRuntimeStateSpy = vi
      .spyOn(CasesRuntimeState, 'storeRuntimeState')
      .mockResolvedValue(undefined);
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);
    return { events, mockSendMessage, storeRuntimeStateSpy };
  }

  function getDlqOutput(invocationContext: InvocationContext) {
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    return outputs.find(([key]) => key.queueName?.includes('dlq'));
  }

  function getSentPages(mockSendMessage: { mock: { calls: unknown[][] } }) {
    return mockSendMessage.mock.calls.map(
      ([body]) => JSON.parse(body as string) as { events: CaseSyncEvent[] },
    );
  }

  test('should send pages to the page queue and store runtime state', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { events, mockSendMessage, storeRuntimeStateSpy } = await setupMocks();

    await handleStart({}, invocationContext);

    expect(getSentPages(mockSendMessage)).toEqual([{ events }]);
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
    const { events, mockSendMessage, storeRuntimeStateSpy } = await setupMocks();
    storeRuntimeStateSpy.mockRejectedValue(new Error('watermark upsert failed'));
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, invocationContext);

    expect(getSentPages(mockSendMessage)).toEqual([{ events }]);
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

  test('should split 201 events into pages of at most 100 and deliver each event exactly once', async () => {
    const { handleStart } = await import('./sync-cases');
    const invocationContext = makeInvocationContext();
    const { events, mockSendMessage, storeRuntimeStateSpy } = await setupMocks(201);

    await handleStart({}, invocationContext);

    const pages = getSentPages(mockSendMessage);
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
    const { events, mockSendMessage, storeRuntimeStateSpy } = await setupMocks(201);
    mockSendMessage
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('queue unavailable'));

    await handleStart({}, invocationContext);

    expect(storeRuntimeStateSpy).not.toHaveBeenCalled();
    expect(getDlqOutput(invocationContext)).toBeDefined();
    const page3CaseIds = events.slice(200).map((event) => event.caseId);
    const sentCaseIds = getSentPages(mockSendMessage).flatMap((page) =>
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
