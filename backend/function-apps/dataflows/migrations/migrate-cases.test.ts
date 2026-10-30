import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as ExportAndLoadCaseModule from '../../../lib/use-cases/dataflows/export-and-load-case';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import * as CasesRuntimeStateModule from '../../../lib/use-cases/dataflows/cases-runtime-state';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as MigrateCasesModule from '../../../lib/use-cases/dataflows/migrate-cases';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'migrate-cases',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('migrate-cases handlePage', () => {
  beforeEach(() => {
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process events and emit telemetry on success', async () => {
    const { handlePage } = (await import('./migrate-cases')) as unknown as {
      handlePage: (
        range: { start: number; end: number },
        invocationContext: InvocationContext,
      ) => Promise<void>;
    };
    const range = { start: 1, end: 100 };
    const invocationContext = makeInvocationContext();
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];

    vi.spyOn(MigrateCasesModule.default, 'getPageOfCaseEvents').mockResolvedValue({
      events,
      error: undefined,
    });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue(
      events as Awaited<ReturnType<typeof ExportAndLoadCaseModule.default.exportAndLoad>>,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(range, invocationContext);

    expect(ExportAndLoadCaseModule.default.exportAndLoad).toHaveBeenCalledWith(
      expect.anything(),
      events,
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 1, documentsFailed: 0 }),
    );
  });

  test('should re-enqueue with backoff and emit rate-limited-requeued telemetry on 429', async () => {
    const { handlePage } = (await import('./migrate-cases')) as unknown as {
      handlePage: (
        range: { start: number; end: number; retryCount?: number },
        invocationContext: InvocationContext,
      ) => Promise<void>;
    };
    const range = { start: 1, end: 100, retryCount: 0 };
    const invocationContext = makeInvocationContext();
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];

    vi.spyOn(MigrateCasesModule.default, 'getPageOfCaseEvents').mockResolvedValue({
      events,
      error: undefined,
    });
    const tooManyError = new TooManyRequestsError('MIGRATE-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(tooManyError);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(range, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [sentBody, visibilityTimeout] = mockSendMessage.mock.calls[0];
    expect(JSON.parse(sentBody)).toEqual(
      expect.objectContaining({
        start: 1,
        end: 100,
        retryCount: 1,
        firstAttemptAt: expect.any(String),
      }),
    );
    expect(visibilityTimeout).toBeGreaterThan(0);
    expect(visibilityTimeout).toBeLessThanOrEqual(600);
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handlePage } = (await import('./migrate-cases')) as unknown as {
      handlePage: (
        range: { start: number; end: number; retryCount?: number },
        invocationContext: InvocationContext,
      ) => Promise<void>;
    };
    const range = { start: 1, end: 100, retryCount: 10 };
    const invocationContext = makeInvocationContext();
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];

    vi.spyOn(MigrateCasesModule.default, 'getPageOfCaseEvents').mockResolvedValue({
      events,
      error: undefined,
    });
    const tooManyError = new TooManyRequestsError('MIGRATE-CASES');
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(tooManyError);
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(range, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
    );
  });

  test('should re-throw on non-429 error', async () => {
    const { handlePage } = (await import('./migrate-cases')) as unknown as {
      handlePage: (
        range: { start: number; end: number },
        invocationContext: InvocationContext,
      ) => Promise<void>;
    };
    const range = { start: 1, end: 100 };
    const invocationContext = makeInvocationContext();
    const events: CaseSyncEvent[] = [{ type: 'MIGRATION', caseId: '001-25-00001' }];

    vi.spyOn(MigrateCasesModule.default, 'getPageOfCaseEvents').mockResolvedValue({
      events,
      error: undefined,
    });
    const error = new CamsError('MIGRATE-CASES', { message: 'Database connection failed' });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockRejectedValue(error);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handlePage(range, invocationContext)).rejects.toThrow(
      'Database connection failed',
    );
  });

  test('routes only the failed events to DLQ when exportAndLoad returns a mix of success and failure', async () => {
    const { handlePage } = (await import('./migrate-cases')) as unknown as {
      handlePage: (
        range: { start: number; end: number },
        invocationContext: InvocationContext,
      ) => Promise<void>;
    };
    const range = { start: 1, end: 100 };
    const invocationContext = makeInvocationContext();
    const okEvent: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const failedEvent: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: '001-25-00002',
      error: new CamsError('TEST', { message: 'bad' }),
    };

    vi.spyOn(MigrateCasesModule.default, 'getPageOfCaseEvents').mockResolvedValue({
      events: [okEvent, failedEvent],
      error: undefined,
    });
    vi.spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad').mockResolvedValue([
      okEvent,
      failedEvent,
    ]);
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(range, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      [failedEvent],
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'MIGRATE-CASES',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 1, documentsFailed: 1 }),
    );
  });

  test('routes a buildQueueError to DLQ and exports nothing when getPageOfCaseEvents fails', async () => {
    const { handlePage } = (await import('./migrate-cases')) as unknown as {
      handlePage: (
        range: { start: number; end: number },
        invocationContext: InvocationContext,
      ) => Promise<void>;
    };
    const range = { start: 1, end: 100 };
    const invocationContext = makeInvocationContext();
    const acmsError = new CamsError('MIGRATE-CASES-USE-CASE', { message: 'ACMS unavailable' });

    vi.spyOn(MigrateCasesModule.default, 'getPageOfCaseEvents').mockResolvedValue({
      events: undefined,
      error: acmsError,
    });
    const exportAndLoadSpy = vi
      .spyOn(ExportAndLoadCaseModule.default, 'exportAndLoad')
      .mockResolvedValue([]);
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handlePage(range, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.objectContaining({ error: acmsError }),
    );
    expect(exportAndLoadSpy).toHaveBeenCalledWith(expect.anything(), []);
  });
});

describe('migrate-cases handleStart', () => {
  test('queues pages and stores runtime state when the migration table is empty and has cases', async () => {
    const { handleStart } = await import('./migrate-cases');
    const invocationContext = makeInvocationContext();

    vi.spyOn(MigrateCasesModule.default, 'emptyMigrationTable').mockResolvedValue({
      success: true,
    });
    vi.spyOn(MigrateCasesModule.default, 'loadMigrationTable').mockResolvedValue({ data: 150 });
    const storeRuntimeStateSpy = vi
      .spyOn(CasesRuntimeStateModule.default, 'storeRuntimeState')
      .mockResolvedValue(undefined);
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleStart({}, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('page') }),
      [
        { start: 1, end: 100 },
        { start: 101, end: 200 },
      ],
    );
    expect(storeRuntimeStateSpy).toHaveBeenCalled();
  });

  test('does nothing further and reports to DLQ when emptying the migration table fails', async () => {
    const { handleStart } = await import('./migrate-cases');
    const invocationContext = makeInvocationContext();
    const emptyError = new CamsError('TEST', { message: 'failed to empty table' });

    vi.spyOn(MigrateCasesModule.default, 'emptyMigrationTable').mockResolvedValue({
      error: emptyError,
    });
    const loadMigrationTableSpy = vi.spyOn(MigrateCasesModule.default, 'loadMigrationTable');
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleStart({}, invocationContext);

    expect(loadMigrationTableSpy).not.toHaveBeenCalled();
    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.objectContaining({ error: emptyError }),
    );
  });

  test('does nothing further when there are no cases to migrate', async () => {
    const { handleStart } = await import('./migrate-cases');
    const invocationContext = makeInvocationContext();

    vi.spyOn(MigrateCasesModule.default, 'emptyMigrationTable').mockResolvedValue({
      success: true,
    });
    vi.spyOn(MigrateCasesModule.default, 'loadMigrationTable').mockResolvedValue({ data: 0 });
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleStart({}, invocationContext);

    expect(extraOutputsSetSpy).not.toHaveBeenCalled();
  });

  test('logs and re-throws when an unexpected error occurs', async () => {
    const { handleStart } = await import('./migrate-cases');
    const invocationContext = makeInvocationContext();

    vi.spyOn(MigrateCasesModule.default, 'emptyMigrationTable').mockRejectedValue(
      new Error('boom'),
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handleStart({}, invocationContext)).rejects.toThrow('boom');
  });
});

describe('migrate-cases handleError', () => {
  test('abandons the event without queueing a retry when the error is a NotFoundError', async () => {
    const { handleError } = await import('./migrate-cases');
    const event: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: '001-25-00001',
      error: new NotFoundError('TEST'),
    };
    const invocationContext = makeInvocationContext();
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleError(event, invocationContext);

    expect(extraOutputsSetSpy).not.toHaveBeenCalled();
  });

  test('clears the error and queues the event for retry when the error is not a NotFoundError', async () => {
    const { handleError } = await import('./migrate-cases');
    const event: CaseSyncEvent = {
      type: 'MIGRATION',
      caseId: '001-25-00001',
      error: new CamsError('TEST', { message: 'transient failure' }),
    };
    const invocationContext = makeInvocationContext();
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleError(event, invocationContext);

    const retryCall = extraOutputsSetSpy.mock.calls.find(([key]) =>
      (key as { queueName?: string }).queueName?.includes('retry'),
    );
    expect(retryCall).toBeDefined();
    const [retryEvent] = retryCall?.[1] as CaseSyncEvent[];
    expect(retryEvent.caseId).toBe(event.caseId);
    expect(retryEvent.error).toBeUndefined();
  });
});

describe('migrate-cases handleRetry', () => {
  test('routes to HARD_STOP without calling exportCase once the retry limit is exceeded', async () => {
    const { handleRetry } = await import('./migrate-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001', retryCount: 3 };
    const invocationContext = makeInvocationContext();
    const exportCaseSpy = vi.spyOn(ExportAndLoadCaseModule.default, 'exportCase');
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleRetry(event, invocationContext);

    expect(exportCaseSpy).not.toHaveBeenCalled();
    const hardStopCall = extraOutputsSetSpy.mock.calls.find(([key]) =>
      (key as { queueName?: string }).queueName?.includes('hard-stop'),
    );
    expect(hardStopCall).toBeDefined();
    const [hardStopEvent] = hardStopCall?.[1] as CaseSyncEvent[];
    expect(hardStopEvent.retryCount).toBe(4);
  });

  test('routes to DLQ with an export-failed disposition when exportCase returns no bCase', async () => {
    const { handleRetry } = await import('./migrate-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();
    const exportError = new UnknownError('TEST', { message: 'export failed' });

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportCase').mockResolvedValue({
      ...event,
      error: exportError,
    });
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleRetry(event, invocationContext);

    const dlqCall = extraOutputsSetSpy.mock.calls.find(([key]) =>
      (key as { queueName?: string }).queueName?.includes('dlq'),
    );
    expect(dlqCall).toBeDefined();
    const [dlqEvent] = dlqCall?.[1] as CaseSyncEvent[];
    expect(dlqEvent.error).toBe(exportError);
  });

  test('routes to DLQ with a load-failed disposition when loadCase fails', async () => {
    const { handleRetry } = await import('./migrate-cases');
    const bCase = { caseId: '001-25-00001' } as CaseSyncEvent['bCase'];
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001', bCase };
    const invocationContext = makeInvocationContext();
    const loadError = new CamsError('TEST', { message: 'load failed' });

    vi.spyOn(ExportAndLoadCaseModule.default, 'loadCase').mockResolvedValue({
      ...event,
      error: loadError,
    });
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleRetry(event, invocationContext);

    const dlqCall = extraOutputsSetSpy.mock.calls.find(([key]) =>
      (key as { queueName?: string }).queueName?.includes('dlq'),
    );
    expect(dlqCall).toBeDefined();
    const [dlqEvent] = dlqCall?.[1] as CaseSyncEvent[];
    expect(dlqEvent.error).toBe(loadError);
  });

  test('sets no outputs when export and load both succeed', async () => {
    const { handleRetry } = await import('./migrate-cases');
    const bCase = { caseId: '001-25-00001' } as CaseSyncEvent['bCase'];
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001', bCase };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'loadCase').mockResolvedValue({ ...event });
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleRetry(event, invocationContext);

    expect(extraOutputsSetSpy).not.toHaveBeenCalled();
  });

  test('logs and re-throws when an unexpected error occurs', async () => {
    const { handleRetry } = await import('./migrate-cases');
    const event: CaseSyncEvent = { type: 'MIGRATION', caseId: '001-25-00001' };
    const invocationContext = makeInvocationContext();

    vi.spyOn(ExportAndLoadCaseModule.default, 'exportCase').mockRejectedValue(new Error('boom'));
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handleRetry(event, invocationContext)).rejects.toThrow('boom');
  });
});
