import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as SyncTrusteeCaseAppointmentsModule from '../../../lib/use-cases/dataflows/sync-trustee-case-appointments';
import * as RegionDriverModule from '../../../lib/use-cases/dataflows/trustee-appointment-region-driver';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import DateHelper from '@common/date-helper';

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
    source: 'DXTR',
    sourceTrustee: {} as never,
  }) as TrusteeAppointmentSyncEvent;

const makeEmptyScenarioDistribution = () => ({
  autoMatchCount: 0,
  autoMatchUncoveredCount: 0,
  noMatchCount: 0,
  multipleMatchCount: 0,
  reVerificationCount: 0,
  verificationBucketHitCount: 0,
  fingerprintHitCount: 0,
  fingerprintMissCount: 0,
  retryableCount: 0,
  pipelineSkippedCount: 0,
  unappointableChapterSkippedCount: 0,
  emptyDemographicsSkippedCount: 0,
  sentinelBogusNameSkippedCount: 0,
  unattributableBogusNameSkippedCount: 0,
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
      retryableEvents: [],
    };
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue(
      processResult,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(SyncTrusteeCaseAppointmentsModule.default.processAppointments).toHaveBeenCalledWith(
      expect.anything(),
      events,
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 2, documentsFailed: 0 }),
    );
  });

  test('should surface fingerprintHitCount/fingerprintMissCount in the dataflow-run summary and metrics', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const events = [
      makeTrusteeEvent('001-25-00001'),
      makeTrusteeEvent('001-25-00002'),
      makeTrusteeEvent('001-25-00003'),
      makeTrusteeEvent('001-25-00004'),
    ];
    const message = { events };
    const invocationContext = makeInvocationContext();

    const processResult = {
      successCount: 4,
      dlqMessages: [],
      scenarioDistribution: {
        ...makeEmptyScenarioDistribution(),
        fingerprintHitCount: 1,
        fingerprintMissCount: 3,
      },
      notYetSyncedEvents: [],
      retryableEvents: [],
    };
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue(
      processResult,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({
        details: expect.objectContaining({
          fingerprintHitCount: '1',
          fingerprintMissCount: '3',
        }),
        additionalMetrics: expect.arrayContaining([
          { name: 'TrusteeFingerprintHitRate', value: 25 },
        ]),
      }),
    );
  });

  test('should surface retryableCount in the dataflow-run summary and metrics', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const events = [makeTrusteeEvent('001-25-00001'), makeTrusteeEvent('001-25-00002')];
    const message = { events };
    const invocationContext = makeInvocationContext();
    const retryableEvent = makeTrusteeEvent('001-25-00002');

    const processResult = {
      successCount: 1,
      dlqMessages: [],
      scenarioDistribution: { ...makeEmptyScenarioDistribution(), retryableCount: 1 },
      notYetSyncedEvents: [],
      retryableEvents: [retryableEvent],
    };
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue(
      processResult,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as StorageQueueHumbleObject);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({
        details: expect.objectContaining({ retryableCount: '1' }),
        additionalMetrics: expect.arrayContaining([
          { name: 'TrusteeRetryableEventCount', value: 1 },
        ]),
      }),
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
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockRejectedValue(
      tooManyError,
    );
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

  test('does not let notYetSyncedRetryCount and the generic rate-limit retryCount cross-contaminate', async () => {
    // A page can carry a notYetSyncedRetryCount from a prior not-yet-synced-case retry AND then
    // hit a generic transient error (429) in a later invocation of the same page. Before this fix,
    // both policies shared one `retryCount` field: a not-yet-synced retry could reach the
    // not-yet-synced DLQ threshold after only one real not-yet-synced attempt if a rate-limit
    // retry had already bumped the shared counter, or vice versa. This asserts the two counters
    // are read/written independently: notYetSyncedRetryCount is preserved unchanged on the
    // rate-limit retry message, and handleRateLimitRetry's own retryCount starts from its own
    // field, not from notYetSyncedRetryCount.
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events, notYetSyncedRetryCount: 1, retryCount: 0 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-TRUSTEE-CASE-APPOINTMENTS');
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockRejectedValue(
      tooManyError,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    const sentMessage = JSON.parse(mockSendMessage.mock.calls[0][0] as string);
    expect(sentMessage.notYetSyncedRetryCount).toBe(1);
    expect(sentMessage.retryCount).toBe(1);
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events, retryCount: 10 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-TRUSTEE-CASE-APPOINTMENTS');
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockRejectedValue(
      tooManyError,
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
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockRejectedValue(
      error,
    );
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

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [notYetSyncedEvent],
      retryableEvents: [],
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
      JSON.stringify({ events: [notYetSyncedEvent], notYetSyncedRetryCount: 1 }),
      4 * 60 * 60,
    );
  });

  test('should requeue with an incremented retryCount when at the retry limit (second retry)', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const notYetSyncedEvent = makeTrusteeEvent('001-25-00003');
    const message = { events: [notYetSyncedEvent], notYetSyncedRetryCount: 1 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [notYetSyncedEvent],
      retryableEvents: [],
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
      JSON.stringify({ events: [notYetSyncedEvent], notYetSyncedRetryCount: 2 }),
      4 * 60 * 60,
    );
  });

  test('should route not-yet-synced events to DLQ instead of retrying once the retry limit is exceeded', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const notYetSyncedEvent = makeTrusteeEvent('001-25-00003');
    const message = { events: [notYetSyncedEvent], notYetSyncedRetryCount: 2 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [notYetSyncedEvent],
      retryableEvents: [],
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    const fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    const pageQueueCalls = fromConnectionStringSpy.mock.calls.filter(([, queueName]) =>
      queueName?.includes('page'),
    );
    expect(pageQueueCalls).toHaveLength(0);

    expect(fromConnectionStringSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('dlq'),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(notYetSyncedEvent));
  });

  test('should requeue retryableEvents with an exponential backoff (+/-10% jitter) visibility delay and an incremented retryableRetryCount', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const { computeBackoffSeconds } = await import('../dataflows-rate-limit');
    // Stub the jitter entropy source so the visibility timeout is deterministic. This asserts an
    // exact value again (rand=0 -> low end of the jitter band), but against
    // computeBackoffSecondsWithJitter's contract rather than the pre-jitter formula, so it stays
    // meaningful as regression coverage instead of just re-deriving the production calculation.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const retryableEvent = makeTrusteeEvent('001-25-00005');
    const message = { events: [retryableEvent] };
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [],
      retryableEvents: [retryableEvent],
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [sentBody, sentVisibilityTimeout] = mockSendMessage.mock.calls[0];
    expect(JSON.parse(sentBody)).toEqual({
      events: [retryableEvent],
      retryableRetryCount: 1,
    });
    const base = computeBackoffSeconds(1);
    expect(sentVisibilityTimeout).toBe(Math.round(base * 0.9));
    // Sanity-check the timeout also stays within the documented +/-10% band, independent of the
    // exact rounding chosen above.
    expect(sentVisibilityTimeout).toBeGreaterThanOrEqual(Math.round(base * 0.9));
    expect(sentVisibilityTimeout).toBeLessThanOrEqual(Math.round(base * 1.1));
  });

  test('should surface the incoming retryableRetryCount as a retry-depth metric when requeuing', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const retryableEvent = makeTrusteeEvent('001-25-00005');
    // Page arrives already at retry depth 3 -- a prior invocation requeued it twice before.
    const message = { events: [retryableEvent], retryableRetryCount: 3 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: { ...makeEmptyScenarioDistribution(), retryableCount: 1 },
      notYetSyncedEvents: [],
      retryableEvents: [retryableEvent],
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue(undefined),
    } as unknown as StorageQueueHumbleObject);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({
        additionalMetrics: expect.arrayContaining([
          { name: 'TrusteeRetryableRetryDepth', value: 3 },
        ]),
      }),
    );
  });

  test('should route retryableEvents to DLQ instead of retrying once the rate-limit retry limit is exceeded', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const { RATE_LIMIT_RETRY_LIMIT } = await import('../dataflows-rate-limit');
    const retryableEvent = makeTrusteeEvent('001-25-00005');
    const message = { events: [retryableEvent], retryableRetryCount: RATE_LIMIT_RETRY_LIMIT };
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [],
      retryableEvents: [retryableEvent],
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    const fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);

    await handlePage(message, invocationContext);

    const pageQueueCalls = fromConnectionStringSpy.mock.calls.filter(([, queueName]) =>
      queueName?.includes('page'),
    );
    expect(pageQueueCalls).toHaveLength(0);

    expect(fromConnectionStringSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('dlq'),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(retryableEvent));
  });

  test('should not retry or DLQ a transferred-case skip (no notYetSyncedEvents produced)', async () => {
    const { handlePage } = await import('./sync-trustee-case-appointments');
    const message = { events: [makeTrusteeEvent('001-25-00004')] };
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      notYetSyncedEvents: [],
      retryableEvents: [],
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

describe('sync-trustee-case-appointments handleStart', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  const emptyResult = {
    processedRegions: ['02'],
    dlqMessages: [],
    retryableEvents: [],
    notYetSyncedEvents: [],
  };

  async function setupMocks(overrides?: {
    runRegionDriverResult?: typeof emptyResult & {
      continuation?: {
        regions: string[];
        runDate: string;
        resumeFrom?: { regionId: string; date: string; lastId?: string };
        cause: 'invocation-budget' | 'transient-error';
      };
    };
    deleteAllResult?: { data: { deleted: number }; error?: Error };
  }) {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const runRegionDriverSpy = vi
      .spyOn(RegionDriverModule.default, 'runRegionDriver')
      .mockResolvedValue(overrides?.runRegionDriverResult ?? emptyResult);
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'deleteAll').mockResolvedValue(
      overrides?.deleteAllResult ?? { data: { deleted: 0 } },
    );
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    const fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);
    return { mockContext, mockSendMessage, fromConnectionStringSpy, runRegionDriverSpy };
  }

  test('calls the region driver with the named regions and a default run date', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy, mockContext } = await setupMocks();

    await handleStart({ regions: ['02', '03'] }, invocationContext);

    expect(runRegionDriverSpy).toHaveBeenCalledWith(
      mockContext,
      expect.objectContaining({ regions: ['02', '03'], resumeFrom: undefined }),
    );
    const callArgs = runRegionDriverSpy.mock.calls[0][1];
    expect(callArgs.runDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('passes an explicit runDate and resumeFrom through unchanged', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy, mockContext } = await setupMocks();
    const resumeFrom = { regionId: '02', date: '2026-07-02', lastId: '1001' };

    await handleStart({ regions: ['02'], runDate: '2026-07-05', resumeFrom }, invocationContext);

    expect(runRegionDriverSpy).toHaveBeenCalledWith(mockContext, {
      regions: ['02'],
      runDate: '2026-07-05',
      resumeFrom,
    });
  });

  test('routes dlqMessages from the driver result directly to the DLQ', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const dlqEvent = makeTrusteeEvent('081-26-00001');
    const { mockSendMessage } = await setupMocks({
      runRegionDriverResult: { ...emptyResult, dlqMessages: [dlqEvent] },
    });

    await handleStart({ regions: ['02'] }, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(dlqEvent));
  });

  test('queues retryable and not-yet-synced events for their first delayed retry via handlePage', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const retryableEvent = makeTrusteeEvent('081-26-00002');
    const notYetSyncedEvent = makeTrusteeEvent('081-26-00003');
    const { mockSendMessage } = await setupMocks({
      runRegionDriverResult: {
        ...emptyResult,
        retryableEvents: [retryableEvent],
        notYetSyncedEvents: [notYetSyncedEvent],
      },
    });

    await handleStart({ regions: ['02'] }, invocationContext);

    const sentBodies = mockSendMessage.mock.calls.map((call) => JSON.parse(call[0]));
    expect(sentBodies).toContainEqual(expect.objectContaining({ events: [retryableEvent] }));
    expect(sentBodies).toContainEqual(expect.objectContaining({ events: [notYetSyncedEvent] }));
  });

  test('re-enqueues a continuation message to the START queue when the driver escapes', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const continuation = {
      regions: ['02', '03'],
      runDate: '2026-07-05',
      resumeFrom: { regionId: '02', date: '2026-07-02', lastId: '1001' },
      cause: 'invocation-budget' as const,
    };
    const { mockSendMessage } = await setupMocks({
      runRegionDriverResult: { ...emptyResult, continuation },
    });

    await handleStart({ regions: ['02', '03'], runDate: '2026-07-05' }, invocationContext);

    const sentBodies = mockSendMessage.mock.calls.map((call) => JSON.parse(call[0]));
    expect(sentBodies).toContainEqual({
      regions: continuation.regions,
      runDate: continuation.runDate,
      resumeFrom: continuation.resumeFrom,
    });
  });

  test('re-enqueues a transient-error continuation with the resume point, count + 1, and a 300s delay when nothing progressed', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const resumeFrom = { regionId: '02', date: '2026-07-02', lastId: '1001' };
    const { mockSendMessage } = await setupMocks({
      runRegionDriverResult: {
        ...emptyResult,
        continuation: {
          regions: ['02'],
          runDate: '2026-07-05',
          resumeFrom,
          cause: 'transient-error',
        },
      },
    });

    await handleStart(
      { regions: ['02'], runDate: '2026-07-05', resumeFrom, transientRetryCount: 2 },
      invocationContext,
    );

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [body, delaySeconds] = mockSendMessage.mock.calls[0];
    expect(JSON.parse(body)).toEqual({
      regions: ['02'],
      runDate: '2026-07-05',
      resumeFrom,
      transientRetryCount: 3,
    });
    expect(delaySeconds).toBe(300);
  });

  test.each([
    {
      description: 'the resume point moved',
      incomingRegions: ['02'],
      continuedResumeFrom: { regionId: '02', date: '2026-07-02', lastId: '2002' },
      continuedRegions: ['02'],
    },
    {
      description: 'fewer regions remain',
      incomingRegions: ['02', '03'],
      continuedResumeFrom: { regionId: '02', date: '2026-07-02', lastId: '1001' },
      continuedRegions: ['03'],
    },
  ])(
    'resets the transient retry count to 1 when $description since the incoming message',
    async ({ incomingRegions, continuedResumeFrom, continuedRegions }) => {
      const { handleStart } = await import('./sync-trustee-case-appointments');
      const invocationContext = makeInvocationContext();
      const { mockSendMessage } = await setupMocks({
        runRegionDriverResult: {
          ...emptyResult,
          continuation: {
            regions: continuedRegions,
            runDate: '2026-07-05',
            resumeFrom: continuedResumeFrom,
            cause: 'transient-error',
          },
        },
      });

      await handleStart(
        {
          regions: incomingRegions,
          runDate: '2026-07-05',
          resumeFrom: { regionId: '02', date: '2026-07-02', lastId: '1001' },
          transientRetryCount: 4,
        },
        invocationContext,
      );

      expect(JSON.parse(mockSendMessage.mock.calls[0][0]).transientRetryCount).toBe(1);
    },
  );

  test.each([
    { incomingCount: undefined, sentCount: 1 },
    { incomingCount: 4, sentCount: 5 },
  ])(
    'requeues a transient continuation with no progress when the incoming count is $incomingCount (sends $sentCount)',
    async ({ incomingCount, sentCount }) => {
      const { handleStart } = await import('./sync-trustee-case-appointments');
      const invocationContext = makeInvocationContext();
      const resumeFrom = { regionId: '02', date: '2026-07-02', lastId: '1001' };
      const { mockSendMessage } = await setupMocks({
        runRegionDriverResult: {
          ...emptyResult,
          continuation: {
            regions: ['02'],
            runDate: '2026-07-05',
            resumeFrom,
            cause: 'transient-error',
          },
        },
      });

      await handleStart(
        { regions: ['02'], runDate: '2026-07-05', resumeFrom, transientRetryCount: incomingCount },
        invocationContext,
      );

      expect(JSON.parse(mockSendMessage.mock.calls[0][0]).transientRetryCount).toBe(sentCount);
    },
  );

  test('stops without re-enqueueing or dead-lettering once the transient retry count would exceed 5, logging the stop and failing the trace', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    invocationContext.extraOutputs.set = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    vi.spyOn(ApplicationContextCreator, 'getLogger').mockReturnValue(
      logger as unknown as ReturnType<typeof ApplicationContextCreator.getLogger>,
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');
    const resumeFrom = { regionId: '02', date: '2026-07-02', lastId: '1001' };
    const { mockSendMessage } = await setupMocks({
      runRegionDriverResult: {
        ...emptyResult,
        continuation: {
          regions: ['02'],
          runDate: '2026-07-05',
          resumeFrom,
          cause: 'transient-error',
        },
      },
    });

    await handleStart(
      { regions: ['02'], runDate: '2026-07-05', resumeFrom, transientRetryCount: 5 },
      invocationContext,
    );

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Transient errors persisted through 5 requeues'),
      expect.anything(),
    );
    expect(telemetrySpy).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(String),
      'handleStart',
      expect.anything(),
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Transient errors persisted'),
      }),
    );
  });

  test('treats a continuation as progress when the incoming message had no resume point', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupMocks({
      runRegionDriverResult: {
        ...emptyResult,
        continuation: {
          regions: ['02'],
          runDate: '2026-07-05',
          resumeFrom: { regionId: '02', date: '2026-07-02', lastId: '1001' },
          cause: 'transient-error',
        },
      },
    });

    await handleStart(
      { regions: ['02'], runDate: '2026-07-05', transientRetryCount: 3 },
      invocationContext,
    );

    expect(JSON.parse(mockSendMessage.mock.calls[0][0]).transientRetryCount).toBe(1);
  });

  test('a budget continuation carries no transient retry count, so the count resets', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupMocks({
      runRegionDriverResult: {
        ...emptyResult,
        continuation: {
          regions: ['02'],
          runDate: '2026-07-05',
          resumeFrom: { regionId: '02', date: '2026-07-02', lastId: '1001' },
          cause: 'invocation-budget',
        },
      },
    });

    await handleStart(
      { regions: ['02'], runDate: '2026-07-05', transientRetryCount: 3 },
      invocationContext,
    );

    const [body, delaySeconds] = mockSendMessage.mock.calls[0];
    expect(JSON.parse(body)).not.toHaveProperty('transientRetryCount');
    expect(delaySeconds).toBeUndefined();
  });

  test('a budget continuation preserves the originating laneId', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupMocks({
      runRegionDriverResult: {
        ...emptyResult,
        continuation: {
          regions: ['02'],
          runDate: '2026-07-05',
          cause: 'invocation-budget',
        },
      },
    });

    await handleStart({ regions: ['02'], laneId: 1 }, invocationContext);

    const [body] = mockSendMessage.mock.calls[0];
    expect(JSON.parse(body)).toMatchObject({ laneId: 1 });
  });

  test('re-enqueues the original start message with count + 1 and a 300s delay when the handler throws a transient error, and does not dead-letter it', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    invocationContext.extraOutputs.set = vi.fn();
    const { mockSendMessage, runRegionDriverSpy } = await setupMocks();
    runRegionDriverSpy.mockRejectedValue(new TooManyRequestsError('TEST'));

    await handleStart(
      { regions: ['02'], runDate: '2026-07-05', transientRetryCount: 1 },
      invocationContext,
    );

    const [body, delaySeconds] = mockSendMessage.mock.calls[0];
    expect(JSON.parse(body)).toEqual({
      regions: ['02'],
      runDate: '2026-07-05',
      transientRetryCount: 2,
    });
    expect(delaySeconds).toBe(300);
    expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();
  });

  test('clears deleteAll on the re-enqueued message once deleteAll has succeeded, so a later failure cannot reset the run', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { mockSendMessage, runRegionDriverSpy } = await setupMocks();
    runRegionDriverSpy.mockRejectedValue(new TooManyRequestsError('TEST'));

    await handleStart({ regions: ['02'], deleteAll: true }, invocationContext);

    const body = JSON.parse(mockSendMessage.mock.calls[0][0]);
    expect(body).not.toHaveProperty('deleteAll');
    expect(body.transientRetryCount).toBe(1);
  });

  test('keeps deleteAll on the re-enqueued message when deleteAll itself failed transiently, and does not run the driver', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    invocationContext.extraOutputs.set = vi.fn();
    const { mockSendMessage, runRegionDriverSpy } = await setupMocks({
      deleteAllResult: { data: { deleted: 0 }, error: new TooManyRequestsError('TEST') },
    });

    await handleStart({ regions: ['02'], deleteAll: true }, invocationContext);

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
    expect(JSON.parse(mockSendMessage.mock.calls[0][0])).toMatchObject({
      deleteAll: true,
      transientRetryCount: 1,
    });
    expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();
  });

  test('dead-letters a non-transient error together with the start message so it can be replayed', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    invocationContext.extraOutputs.set = vi.fn();
    const { runRegionDriverSpy } = await setupMocks();
    runRegionDriverSpy.mockRejectedValue(new Error('boom'));

    await handleStart({ regions: ['02'], runDate: '2026-07-05' }, invocationContext);

    expect(invocationContext.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'QUEUE_ERROR',
        startMessage: { regions: ['02'], runDate: '2026-07-05' },
      }),
    );
  });

  test('dead-letters the re-enqueue payload when the transient re-enqueue send itself fails', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    invocationContext.extraOutputs.set = vi.fn();
    const { mockSendMessage, runRegionDriverSpy } = await setupMocks();
    runRegionDriverSpy.mockRejectedValue(new TooManyRequestsError('TEST'));
    mockSendMessage.mockRejectedValue(new Error('queue unavailable'));

    await handleStart({ regions: ['02'], runDate: '2026-07-05' }, invocationContext);

    expect(invocationContext.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'QUEUE_ERROR',
        startMessage: { regions: ['02'], runDate: '2026-07-05', transientRetryCount: 1 },
      }),
    );
  });

  test('falls through to the region driver when deleteAll is set and deletion succeeds', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy } = await setupMocks();

    await handleStart({ regions: ['02'], deleteAll: true }, invocationContext);

    expect(runRegionDriverSpy).toHaveBeenCalled();
  });

  test('routes a deleteAll failure to the DLQ and does not call the region driver', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    invocationContext.extraOutputs.set = vi.fn();
    const { runRegionDriverSpy } = await setupMocks({
      deleteAllResult: { data: { deleted: 0 }, error: new Error('delete failed') },
    });

    await handleStart({ regions: ['02'], deleteAll: true }, invocationContext);

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
    expect(invocationContext.extraOutputs.set).toHaveBeenCalled();
  });

  test('discards a stale resumeFrom when deleteAll is set so the reset history is re-walked', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy } = await setupMocks();
    const staleResumeFrom = { regionId: '02', date: '2026-08-01', lastId: '1001' };

    await handleStart(
      { regions: ['02'], deleteAll: true, resumeFrom: staleResumeFrom },
      invocationContext,
    );

    expect(runRegionDriverSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resumeFrom: undefined }),
    );
  });

  test('flushQueues short-circuits before the region driver is ever called', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy } = await setupMocks();

    await handleStart({ regions: ['02'], flushQueues: true }, invocationContext);

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
  });

  test('routes to the DLQ when AzureWebJobsDataflowsStorage is missing', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    invocationContext.extraOutputs.set = vi.fn();

    await handleStart({ regions: ['02'] }, invocationContext);

    expect(invocationContext.extraOutputs.set).toHaveBeenCalled();
  });
});

describe('sync-trustee-case-appointments handleStart fan-out', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
    delete process.env.TRUSTEE_APPOINTMENT_LANE_COUNT;
  });

  async function setupFanOutMocks(regionIds: string[]) {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(RegionDriverModule.default, 'getAllRegionIds').mockResolvedValue(regionIds);
    const runRegionDriverSpy = vi.spyOn(RegionDriverModule.default, 'runRegionDriver');
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    const fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);
    return { mockContext, mockSendMessage, fromConnectionStringSpy, runRegionDriverSpy };
  }

  test('a start message with no regions never calls the region driver directly', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy } = await setupFanOutMocks(['01', '02', '03']);

    await handleStart({}, invocationContext);

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
  });

  test('fans out every region across lanes with no duplicates or omissions', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const regions = ['01', '02', '03', '04', '05', '06'];
    const { mockSendMessage } = await setupFanOutMocks(regions);

    await handleStart({}, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledTimes(3); // default lane count
    const sentMessages = mockSendMessage.mock.calls.map(([body]) => JSON.parse(body));
    // Which region lands in which lane is lane-assignment.ts's own contract (tested there) --
    // this only asserts fanOutAcrossLanes' own behavior: every region covered exactly once, and
    // each message's laneId is its lane's position in the assignment.
    expect(sentMessages.flatMap((m) => m.regions).sort()).toEqual(regions);
    expect(sentMessages.map((m) => m.laneId)).toEqual([0, 1, 2]);
  });

  test('resolves a default runDate once at kickoff and shares it across every lane message', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupFanOutMocks(['01', '02']);
    vi.spyOn(DateHelper, 'getTodaysIsoDate').mockReturnValue('2026-07-05');

    await handleStart({}, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    const sentMessages = mockSendMessage.mock.calls.map(([body]) => JSON.parse(body));
    expect(sentMessages.map((m) => m.runDate)).toEqual(['2026-07-05', '2026-07-05']);
  });

  test('a deleteAll kickoff resets once and sends lane messages that do not carry deleteAll', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupFanOutMocks(['01', '02']);
    const deleteAllSpy = vi
      .spyOn(SyncTrusteeCaseAppointmentsModule.default, 'deleteAll')
      .mockResolvedValue({ data: { deleted: 0 } });

    await handleStart({ deleteAll: true, runDate: '2026-07-05' }, invocationContext);

    expect(deleteAllSpy).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls.map(([body]) => JSON.parse(body))).toEqual([
      { regions: ['01'], runDate: '2026-07-05', laneId: 0 },
      { regions: ['02'], runDate: '2026-07-05', laneId: 1 },
    ]);
  });

  test('draws a separate jitter delay for each lane message', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupFanOutMocks(['01', '02', '03']);
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99999)
      .mockReturnValueOnce(0.5);

    await handleStart({}, invocationContext);

    expect(mockSendMessage.mock.calls.map(([, delay]) => delay)).toEqual([30, 60, 45]);
  });

  test('an empty region list sends zero lane messages and reports a failed run', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupFanOutMocks([]);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, invocationContext);

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('No regions found'),
        details: expect.objectContaining({ lanesCreated: '0', regionsScheduled: '0' }),
      }),
    );
  });

  test('dead-letters a start message that has resumeFrom but no regions instead of fanning out', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    invocationContext.extraOutputs.set = vi.fn();
    const { mockSendMessage } = await setupFanOutMocks(['01', '02']);
    const startMessage = { resumeFrom: { regionId: '02', date: '2026-08-01' } };

    await handleStart(startMessage, invocationContext);

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(invocationContext.extraOutputs.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR', startMessage }),
    );
  });

  test('logs the fan-out fallback label when transient retries are exhausted on a kickoff', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    vi.spyOn(ApplicationContextCreator, 'getLogger').mockReturnValue(
      logger as unknown as ReturnType<typeof ApplicationContextCreator.getLogger>,
    );
    const { mockSendMessage } = await setupFanOutMocks([]);
    vi.spyOn(RegionDriverModule.default, 'getAllRegionIds').mockRejectedValue(
      new TooManyRequestsError('TEST'),
    );

    await handleStart({ transientRetryCount: 5 }, invocationContext);

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('(fan-out: all regions)'),
      expect.anything(),
    );
  });

  test('logs each lane assignment with its laneId, regions, and jitter delay', async () => {
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    vi.spyOn(ApplicationContextCreator, 'getLogger').mockReturnValue(
      logger as unknown as ReturnType<typeof ApplicationContextCreator.getLogger>,
    );
    await setupFanOutMocks(['01', '02']);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await handleStart({}, invocationContext);

    expect(logger.info).toHaveBeenCalledWith(
      expect.anything(),
      'Fan-out lane 0: 1 region(s) [01], first message delayed 30s.',
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.anything(),
      'Fan-out lane 1: 1 region(s) [02], first message delayed 30s.',
    );
  });

  test('a valid TRUSTEE_APPOINTMENT_LANE_COUNT override changes how many lanes are created', async () => {
    process.env.TRUSTEE_APPOINTMENT_LANE_COUNT = '2';
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupFanOutMocks(['01', '02', '03', '04']);

    await handleStart({}, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  test.each([
    ['not-a-number', 'non-numeric'],
    ['0', 'zero'],
    ['-1', 'negative'],
    ['2abc', 'numeric prefix'],
    ['2.5', 'non-integer'],
  ])(
    'a %s (%s) TRUSTEE_APPOINTMENT_LANE_COUNT falls back to the default of 3, with a warning',
    async (invalidValue) => {
      process.env.TRUSTEE_APPOINTMENT_LANE_COUNT = invalidValue;
      const { handleStart } = await import('./sync-trustee-case-appointments');
      const invocationContext = makeInvocationContext();
      const { mockSendMessage } = await setupFanOutMocks(['01', '02', '03', '04', '05', '06']);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await handleStart({}, invocationContext);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Invalid TRUSTEE_APPOINTMENT_LANE_COUNT="${invalidValue}"`),
      );
      // 6 regions, so any lane count other than 3 would produce a different send count
      expect(mockSendMessage).toHaveBeenCalledTimes(3);
    },
  );

  test('caps TRUSTEE_APPOINTMENT_LANE_COUNT at 10, with a warning', async () => {
    process.env.TRUSTEE_APPOINTMENT_LANE_COUNT = '30';
    const { handleStart } = await import('./sync-trustee-case-appointments');
    const invocationContext = makeInvocationContext();
    const regions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const { mockSendMessage } = await setupFanOutMocks(regions);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await handleStart({}, invocationContext);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds the maximum of 10'));
    expect(mockSendMessage).toHaveBeenCalledTimes(10);
  });
});
