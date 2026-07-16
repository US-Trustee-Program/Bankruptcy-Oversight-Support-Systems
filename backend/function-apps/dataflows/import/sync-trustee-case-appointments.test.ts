import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext, Timer } from '@azure/functions';
import * as SyncTrusteeCaseAppointmentsModule from '../../../lib/use-cases/dataflows/sync-trustee-case-appointments';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { TrusteeAppointmentsSyncState } from '../../../lib/use-cases/gateways.types';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'sync-trustee-case-appointments',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeTrusteeEvent = (caseId: string): TrusteeAppointmentSyncEvent =>
  ({
    caseId,
    courtId: '081',
    dxtrTrustee: {} as never,
  }) as TrusteeAppointmentSyncEvent;

const makeEmptyScenarioDistribution = () => ({
  autoMatchCount: 0,
  imperfectMatchCount: 0,
  highConfidenceMatchCount: 0,
  noMatchCount: 0,
  multipleMatchCount: 0,
  reVerificationCount: 0,
  perfectMatchInactiveCount: 0,
});

describe('sync-trustee-case-appointments handlePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process events and emit success telemetry', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const events = [makeTrusteeEvent('001-25-00001'), makeTrusteeEvent('001-25-00002')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    const processResult = {
      successCount: 2,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [],
    };
    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'processAppointments',
    ).mockResolvedValue(processResult);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.processAppointments,
    ).toHaveBeenCalledWith(events);
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 2, documentsFailed: 0 }),
    );
  });

  test('should throw when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    await expect(handlePage(message, invocationContext)).rejects.toThrow(
      'Missing required environment variable: AzureWebJobsDataflowsStorage',
    );
  });

  test('should re-enqueue with backoff and emit rate-limited-requeued telemetry on 429 error', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events, retryCount: 0 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-TRUSTEE-CASE-APPOINTMENTS');
    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'processAppointments',
    ).mockRejectedValue(tooManyError);
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
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events, retryCount: 10 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-TRUSTEE-CASE-APPOINTMENTS');
    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'processAppointments',
    ).mockRejectedValue(tooManyError);
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
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
    );
  });

  test('should re-throw on non-429 error', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    const error = new CamsError('SYNC-TRUSTEE-CASE-APPOINTMENTS', { message: 'Database error' });
    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'processAppointments',
    ).mockRejectedValue(error);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handlePage(message, invocationContext)).rejects.toThrow('Database error');
  });

  test('should requeue not-yet-synced events with a 4-hour visibility timeout and an incremented retryCount when under the retry limit', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const notYetSyncedEvent = makeTrusteeEvent('001-25-00003');
    const message = { events: [notYetSyncedEvent] };
    const invocationContext = makeInvocationContext();

    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'processAppointments',
    ).mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [notYetSyncedEvent],
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledWith(
      JSON.stringify({ events: [notYetSyncedEvent], retryCount: 1 }),
      4 * 60 * 60,
    );
  });

  test('should requeue with an incremented retryCount when at the retry limit (second retry)', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const notYetSyncedEvent = makeTrusteeEvent('001-25-00003');
    const message = { events: [notYetSyncedEvent], retryCount: 1 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'processAppointments',
    ).mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [notYetSyncedEvent],
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledWith(
      JSON.stringify({ events: [notYetSyncedEvent], retryCount: 2 }),
      4 * 60 * 60,
    );
  });

  test('should route not-yet-synced events to DLQ instead of retrying once the retry limit is exceeded', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const notYetSyncedEvent = makeTrusteeEvent('001-25-00003');
    const message = { events: [notYetSyncedEvent], retryCount: 2 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'processAppointments',
    ).mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [notYetSyncedEvent],
    });
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.arrayContaining([notYetSyncedEvent]),
    );
  });

  test('should not retry or DLQ a transferred-case skip (no notYetSyncedEvents produced)', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const message = { events: [makeTrusteeEvent('001-25-00004')] };
    const invocationContext = makeInvocationContext();

    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'processAppointments',
    ).mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [],
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});

describe('sync-trustee-case-appointments handlePagePoison', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should log error, write to DLQ, and emit telemetry with success:false', async () => {
    const { handlePagePoison } = await import('./sync-trustee-case-appointments');
    const message = { events: [{ type: 'TRUSTEE_APPOINTMENT', caseId: '001-25-00001' }] };
    const invocationContext = makeInvocationContext();

    const mockContext = await createMockApplicationContext();
    const logSpy = vi.spyOn(mockContext.logger, 'error');

    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePagePoison(message as Record<string, unknown>, invocationContext);

    expect(logSpy).toHaveBeenCalledWith(
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      expect.stringContaining('Poison message'),
    );

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
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePagePoison',
      expect.anything(),
      expect.objectContaining({ success: false, documentsFailed: 1, error: 'poison-message' }),
    );
  });
});

describe('sync-trustee-case-appointments handleStart', () => {
  const makeEvent = (caseId: string): TrusteeAppointmentSyncEvent =>
    ({
      caseId,
      courtId: '081',
      dxtrTrustee: { fullName: 'John Doe' },
    }) as TrusteeAppointmentSyncEvent;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function setupMocks(overrides?: {
    getAppointmentEventsResult?: {
      events: TrusteeAppointmentSyncEvent[];
      latestSyncDate: string | undefined;
      petitionLatestSyncDate: string | undefined;
    };
    deleteAllResult?: { data: { deleted: number }; error?: Error };
  }) {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'getAppointmentEvents',
    ).mockResolvedValue(
      overrides?.getAppointmentEventsResult ?? {
        events: [],
        latestSyncDate: '',
        petitionLatestSyncDate: '',
      },
    );
    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'storeRuntimeState',
    ).mockResolvedValue(undefined);
    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'storePetitionRuntimeState',
    ).mockResolvedValue(undefined);
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default.prototype, 'deleteAll').mockResolvedValue(
      overrides?.deleteAllResult ?? { data: { deleted: 0 } },
    );
    return mockContext;
  }

  test('should queue pages and emit success telemetry when events are returned', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const events = Array.from({ length: 3 }, (_, i) => makeEvent(`001-25-0000${i}`));

    await setupMocks({
      getAppointmentEventsResult: {
        events,
        latestSyncDate: '2025-06-01T00:00:00Z',
        petitionLatestSyncDate: undefined,
      },
    });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const pageOutput = outputs.find(([key]) => key.queueName?.includes('page'));
    expect(pageOutput).toBeDefined();
    expect(Array.isArray(pageOutput?.[1])).toBe(true);

    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.storeRuntimeState,
    ).toHaveBeenCalledWith('2025-06-01T00:00:00Z');
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 0, documentsFailed: 0 }),
    );
  });

  test('should store petition runtime state when petitionLatestSyncDate is returned', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const events = [makeEvent('001-25-00000')];

    await setupMocks({
      getAppointmentEventsResult: {
        events,
        latestSyncDate: '2025-06-01T00:00:00Z',
        petitionLatestSyncDate: '2025-05-01T00:00:00Z',
      },
    });

    await handleStart({}, invocationContext);

    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.storePetitionRuntimeState,
    ).toHaveBeenCalledWith('2025-05-01T00:00:00Z');
  });

  test('should queue multiple pages when events exceed the page size', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const events = Array.from({ length: 101 }, (_, i) =>
      makeEvent(`001-25-${String(i).padStart(5, '0')}`),
    );

    await setupMocks({
      getAppointmentEventsResult: {
        events,
        latestSyncDate: '2025-06-01T00:00:00Z',
        petitionLatestSyncDate: undefined,
      },
    });

    await handleStart({}, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const pageOutput = outputs.find(([key]) => key.queueName?.includes('page'));
    const pages = pageOutput?.[1] as { events: TrusteeAppointmentSyncEvent[] }[];
    expect(pages).toHaveLength(2);
    expect(pages[0].events).toHaveLength(100);
    expect(pages[1].events).toHaveLength(1);
  });

  test('should return early with success trace when no events are returned', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();

    await setupMocks({
      getAppointmentEventsResult: {
        events: [],
        latestSyncDate: undefined,
        petitionLatestSyncDate: undefined,
      },
    });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, invocationContext);

    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.storeRuntimeState,
    ).not.toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: true }),
    );
    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    expect(outputs.find(([key]) => key.queueName?.includes('page'))).toBeUndefined();
  });

  test('should pass reset flag to getAppointmentEvents', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();

    await setupMocks();

    await handleStart({ reset: true }, invocationContext);

    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.getAppointmentEvents,
    ).toHaveBeenCalledWith(undefined, true, undefined);
  });

  test('should pass overrideRuntimeState flag to getAppointmentEvents', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const override: TrusteeAppointmentsSyncState = {
      documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
      lastSyncDate: '2024-01-01T00:00:00Z',
    };

    await setupMocks();

    await handleStart({ overrideRuntimeState: override }, invocationContext);

    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.getAppointmentEvents,
    ).toHaveBeenCalledWith(undefined, undefined, override);
  });

  test('should call deleteAll and reset state when deleteAll flag is set', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();

    await setupMocks({
      getAppointmentEventsResult: {
        events: [],
        latestSyncDate: undefined,
        petitionLatestSyncDate: undefined,
      },
    });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({ deleteAll: true }, invocationContext);

    expect(SyncTrusteeCaseAppointmentsModule.default.prototype.deleteAll).toHaveBeenCalled();
    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.getAppointmentEvents,
    ).toHaveBeenCalledWith(undefined, true, undefined);
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: true }),
    );
  });

  test('should route to DLQ and emit failure trace when deleteAll fails', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();

    await setupMocks({ deleteAllResult: { data: { deleted: 0 }, error: new Error('DB error') } });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({ deleteAll: true }, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    expect(outputs.find(([key]) => key.queueName?.includes('dlq'))).toBeDefined();
    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.getAppointmentEvents,
    ).not.toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'DB error' }),
    );
  });

  test('should exit early and emit flushQueues trace when flushQueues flag is set', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();

    await setupMocks();
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({ flushQueues: true }, invocationContext);

    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.getAppointmentEvents,
    ).not.toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: true, details: { mode: 'flushQueues' } }),
    );
  });

  test('should route to DLQ and emit failure trace when getAppointmentEvents throws', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(
      SyncTrusteeCaseAppointmentsModule.default.prototype,
      'getAppointmentEvents',
    ).mockRejectedValue(
      new CamsError('SYNC-TRUSTEE-CASE-APPOINTMENTS', { message: 'DXTR unavailable' }),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    expect(outputs.find(([key]) => key.queueName?.includes('dlq'))).toBeDefined();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'DXTR unavailable' }),
    );
  });

  test('should not store runtime state when latestSyncDate is undefined', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const events = [makeEvent('001-25-00001')];

    await setupMocks({
      getAppointmentEventsResult: {
        events,
        latestSyncDate: undefined,
        petitionLatestSyncDate: undefined,
      },
    });

    await handleStart({}, invocationContext);

    expect(
      SyncTrusteeCaseAppointmentsModule.default.prototype.storeRuntimeState,
    ).not.toHaveBeenCalled();
  });
});

describe('sync-trustee-case-appointments timerTrigger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should enqueue a START message and emit success telemetry', async () => {
    const { timerTrigger } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await timerTrigger({} as Timer, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    expect(outputs.find(([key]) => key.queueName?.includes('start'))).toBeDefined();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'timerTrigger',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 0, documentsFailed: 0 }),
    );
  });

  test('should emit failure trace and rethrow when context creation fails', async () => {
    const { timerTrigger } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(mockContext.observability, 'startTrace').mockReturnValue({} as never);
    const error = new Error('context error');
    vi.spyOn(invocationContext.extraOutputs, 'set').mockImplementationOnce(() => {
      throw error;
    });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await expect(timerTrigger({} as Timer, invocationContext)).rejects.toThrow('context error');

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'timerTrigger',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'context error' }),
    );
  });
});
