import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as SyncTrusteeCaseAppointmentsModule from '../../../lib/use-cases/dataflows/sync-trustee-case-appointments';
import * as RegionDriverModule from '../../../lib/use-cases/dataflows/trustee-appointment-region-driver';
import TrusteeAppointmentSyncRun from '../../../lib/use-cases/dataflows/trustee-appointment-sync-run';
import HealParkedCaseAppointments from '../../../lib/use-cases/dataflows/heal-parked-case-appointments';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import DateHelper from '@common/date-helper';
import { computeBackoffSeconds, RATE_LIMIT_RETRY_LIMIT } from '../dataflows-rate-limit';
import {
  handleHeal,
  handlePage,
  handleStart,
  healTimerTrigger,
  timerTrigger,
} from './sync-trustee-case-appointments';

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
  parkedCount: 0,
});

describe('sync-trustee-case-appointments handlePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process events and emit success telemetry', async () => {
    const events = [makeTrusteeEvent('001-25-00001'), makeTrusteeEvent('001-25-00002')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    const processResult = {
      successCount: 2,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
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

  test('reports each scenario count and the auto-match rate in the dataflow-run summary and metrics', async () => {
    const events = Array.from({ length: 8 }, (_, i) => makeTrusteeEvent(`001-25-0000${i + 1}`));
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 8,
      dlqMessages: [],
      scenarioDistribution: {
        ...makeEmptyScenarioDistribution(),
        autoMatchCount: 2,
        autoMatchUncoveredCount: 1,
        noMatchCount: 3,
        multipleMatchCount: 4,
        pipelineSkippedCount: 5,
        reVerificationCount: 6,
        verificationBucketHitCount: 7,
      },
      retryableEvents: [],
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage({ events }, makeInvocationContext());

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({
        details: expect.objectContaining({
          totalEvents: '8',
          autoMatchCount: '2',
          autoMatchUncoveredCount: '1',
          noMatchCount: '3',
          multipleMatchCount: '4',
          pipelineSkippedCount: '5',
          reVerificationCount: '6',
          verificationBucketHitCount: '7',
        }),
        additionalMetrics: expect.arrayContaining([
          { name: 'TrusteeAutoMatchRate', value: 25 },
          { name: 'TrusteeTotalEventsProcessed', value: 8 },
          { name: 'TrusteePipelineSkippedCount', value: 5 },
          { name: 'TrusteeReVerificationCount', value: 6 },
          { name: 'TrusteeVerificationBucketHitCount', value: 7 },
        ]),
      }),
    );
  });

  test('reports zero rates, not NaN, for a page with no events', async () => {
    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
      retryableEvents: [],
    });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage({ events: [] }, makeInvocationContext());

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({
        success: true,
        details: expect.objectContaining({ totalEvents: '0' }),
        additionalMetrics: expect.arrayContaining([
          { name: 'TrusteeAutoMatchRate', value: 0 },
          { name: 'TrusteeFingerprintHitRate', value: 0 },
        ]),
      }),
    );
  });

  test.each([
    {
      field: 'retryableCount',
      metric: 'TrusteeRetryableEventCount',
      retryableEvents: [makeTrusteeEvent('001-25-00002')],
    },
    { field: 'parkedCount', metric: 'TrusteeParkedCount', retryableEvents: [] },
  ])(
    'should surface $field in the dataflow-run summary and metrics',
    async ({ field, metric, retryableEvents }) => {
      vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
        successCount: 1,
        dlqMessages: [],
        scenarioDistribution: { ...makeEmptyScenarioDistribution(), [field]: 1 },
        retryableEvents,
      });
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
        await createMockApplicationContext(),
      );
      vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
        sendMessage: vi.fn().mockResolvedValue(undefined),
      } as unknown as StorageQueueHumbleObject);
      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handlePage({ events: [makeTrusteeEvent('001-25-00001')] }, makeInvocationContext());

      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'SYNC-TRUSTEE-CASE-APPOINTMENTS',
        'handlePage',
        expect.anything(),
        expect.objectContaining({
          details: expect.objectContaining({ [field]: '1' }),
          additionalMetrics: expect.arrayContaining([{ name: metric, value: 1 }]),
        }),
      );
    },
  );

  test('should throw when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    await expect(handlePage(message, invocationContext)).rejects.toThrow(
      'Missing required environment variable: AzureWebJobsDataflowsStorage',
    );
  });

  test('should re-enqueue with backoff and emit rate-limited-requeued telemetry on 429 error', async () => {
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

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
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

  test('should requeue retryableEvents with an exponential backoff (+/-10% jitter) visibility delay and an incremented retryableRetryCount', async () => {
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
    const retryableEvent = makeTrusteeEvent('001-25-00005');
    // Page arrives already at retry depth 3 -- a prior invocation requeued it twice before.
    const message = { events: [retryableEvent], retryableRetryCount: 3 };
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: { ...makeEmptyScenarioDistribution(), retryableCount: 1 },
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
    const retryableEvent = makeTrusteeEvent('001-25-00005');
    const message = { events: [retryableEvent], retryableRetryCount: RATE_LIMIT_RETRY_LIMIT };
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
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

  test('should not retry or DLQ a transferred-case skip', async () => {
    const message = { events: [makeTrusteeEvent('001-25-00004')] };
    const invocationContext = makeInvocationContext();

    vi.spyOn(SyncTrusteeCaseAppointmentsModule.default, 'processAppointments').mockResolvedValue({
      successCount: 0,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
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
    parkedCount: 0,
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
    deleteResult?: { data: { deleted: number }; error?: Error };
  }) {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const runRegionDriverSpy = vi
      .spyOn(RegionDriverModule.default, 'runRegionDriver')
      .mockResolvedValue(overrides?.runRegionDriverResult ?? emptyResult);
    vi.spyOn(TrusteeAppointmentSyncRun, 'claimRun').mockResolvedValue({
      claimed: true,
      runId: 'run-1',
    });
    vi.spyOn(TrusteeAppointmentSyncRun, 'completeLane').mockResolvedValue(undefined);
    const deleteAppointmentsSpy = vi
      .spyOn(SyncTrusteeCaseAppointmentsModule.default, 'deleteAppointments')
      .mockResolvedValue(overrides?.deleteResult ?? { data: { deleted: 0 } });
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    const fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);
    return {
      mockContext,
      mockSendMessage,
      fromConnectionStringSpy,
      runRegionDriverSpy,
      deleteAppointmentsSpy,
    };
  }

  test('calls the region driver with the named regions and a default run date', async () => {
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
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy, mockContext } = await setupMocks();
    const resumeFrom = { regionId: '02', date: '2026-07-02', lastId: '1001' };

    await handleStart({ regions: ['02'], runDate: '2026-07-05', resumeFrom }, invocationContext);

    expect(runRegionDriverSpy).toHaveBeenCalledWith(mockContext, {
      regions: ['02'],
      runDate: '2026-07-05',
      resumeFrom,
      onDateComplete: expect.any(Function),
    });
  });

  test("sends each finished date's results as the driver hands them off, and counts them", async () => {
    const invocationContext = makeInvocationContext();
    const dlqEvent = makeTrusteeEvent('081-26-00001');
    const { mockSendMessage, runRegionDriverSpy } = await setupMocks();
    runRegionDriverSpy.mockImplementation(async (_context, options) => {
      await options.onDateComplete?.({ dlqMessages: [dlqEvent], retryableEvents: [] });
      // Sent before the driver goes on, i.e. before it bookmarks the date.
      expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(dlqEvent));
      return emptyResult;
    });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({ regions: ['02'] }, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({ documentsFailed: 1 }),
    );
  });

  test('routes dlqMessages from the driver result directly to the DLQ', async () => {
    const invocationContext = makeInvocationContext();
    const dlqEvent = makeTrusteeEvent('081-26-00001');
    const { mockSendMessage } = await setupMocks({
      runRegionDriverResult: { ...emptyResult, dlqMessages: [dlqEvent] },
    });

    await handleStart({ regions: ['02'] }, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(dlqEvent));
  });

  test('queues retryable events onto the page queue for handlePage to retry', async () => {
    const retryableEvent = makeTrusteeEvent('081-26-00002');
    const { mockSendMessage, fromConnectionStringSpy } = await setupMocks({
      runRegionDriverResult: { ...emptyResult, retryableEvents: [retryableEvent] },
    });

    await handleStart({ regions: ['02'] }, makeInvocationContext());

    expect(fromConnectionStringSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('-page'),
    );
    const sentBodies = mockSendMessage.mock.calls.map((call) => JSON.parse(call[0]));
    expect(sentBodies).toEqual([{ events: [retryableEvent] }]);
  });

  test('dead-letters a retryable event too large for one queue message instead of paging it', async () => {
    const oversized = {
      ...makeTrusteeEvent('081-26-00009'),
      sourceTrustee: { fullName: 'x'.repeat(70_000) },
    } as TrusteeAppointmentSyncEvent;
    const { mockSendMessage, fromConnectionStringSpy } = await setupMocks({
      runRegionDriverResult: { ...emptyResult, retryableEvents: [oversized] },
    });

    await handleStart({ regions: ['02'] }, makeInvocationContext());

    expect(fromConnectionStringSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('-dlq'),
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const [body] = mockSendMessage.mock.calls[0];
    expect(JSON.parse(body)).toEqual(expect.objectContaining({ type: 'QUEUE_ERROR' }));
    expect(body).toContain('081-26-00009');
  });

  test('reports the parked count in the trace details', async () => {
    const invocationContext = makeInvocationContext();
    await setupMocks({ runRegionDriverResult: { ...emptyResult, parkedCount: 4 } });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({ regions: ['02'] }, invocationContext);

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({
        details: expect.objectContaining({ parkedCount: '4' }),
        additionalMetrics: expect.arrayContaining([{ name: 'TrusteeParkedCount', value: 4 }]),
      }),
    );
  });

  test('re-enqueues a continuation message to the START queue when the driver escapes', async () => {
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
      runId: 'run-1',
    });
  });

  test('re-enqueues a transient-error continuation with the resume point, count + 1, and a 300s delay when nothing progressed', async () => {
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
      runId: 'run-1',
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
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
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
    expect(extraOutputsSetSpy).not.toHaveBeenCalled();
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
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
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
      runId: 'run-1',
      transientRetryCount: 2,
    });
    expect(delaySeconds).toBe(300);
    expect(extraOutputsSetSpy).not.toHaveBeenCalled();
  });

  test('clears delete on the re-enqueued message once the delete has succeeded, so a later failure cannot repeat it', async () => {
    const invocationContext = makeInvocationContext();
    const { mockSendMessage, runRegionDriverSpy } = await setupMocks();
    runRegionDriverSpy.mockRejectedValue(new TooManyRequestsError('TEST'));

    await handleStart({ regions: ['02'], delete: { from: '2026-08-01' } }, invocationContext);

    const body = JSON.parse(mockSendMessage.mock.calls[0][0]);
    expect(body).not.toHaveProperty('delete');
    expect(body.transientRetryCount).toBe(1);
  });

  test('keeps delete on the re-enqueued message when the delete itself failed transiently, and does not run the driver', async () => {
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const { mockSendMessage, runRegionDriverSpy } = await setupMocks({
      deleteResult: { data: { deleted: 0 }, error: new TooManyRequestsError('TEST') },
    });

    await handleStart({ regions: ['02'], delete: { from: '2026-08-01' } }, invocationContext);

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
    expect(JSON.parse(mockSendMessage.mock.calls[0][0])).toMatchObject({
      delete: { from: '2026-08-01' },
      transientRetryCount: 1,
    });
    expect(extraOutputsSetSpy).not.toHaveBeenCalled();
  });

  test('dead-letters a non-transient error together with the start message so it can be replayed', async () => {
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const { runRegionDriverSpy } = await setupMocks();
    runRegionDriverSpy.mockRejectedValue(new Error('boom'));

    await handleStart({ regions: ['02'], runDate: '2026-07-05' }, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'QUEUE_ERROR',
        startMessage: { regions: ['02'], runDate: '2026-07-05' },
      }),
    );
  });

  test('dead-letters the re-enqueue payload when the transient re-enqueue send itself fails', async () => {
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const { mockSendMessage, runRegionDriverSpy } = await setupMocks();
    runRegionDriverSpy.mockRejectedValue(new TooManyRequestsError('TEST'));
    mockSendMessage.mockRejectedValue(new Error('queue unavailable'));

    await handleStart({ regions: ['02'], runDate: '2026-07-05' }, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'QUEUE_ERROR',
        startMessage: {
          regions: ['02'],
          runDate: '2026-07-05',
          runId: 'run-1',
          transientRetryCount: 1,
        },
      }),
    );
  });

  test('falls through to the region driver when delete is set and the delete succeeds', async () => {
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy } = await setupMocks();

    await handleStart({ regions: ['02'], delete: { from: '2026-08-01' } }, invocationContext);

    expect(runRegionDriverSpy).toHaveBeenCalled();
  });

  test("deletes only the named regions' appointments in the given date range", async () => {
    const invocationContext = makeInvocationContext();
    const { deleteAppointmentsSpy, mockContext } = await setupMocks();

    await handleStart(
      { regions: ['02', '03'], delete: { from: '2026-08-01', to: '2026-08-31' } },
      invocationContext,
    );

    expect(deleteAppointmentsSpy).toHaveBeenCalledTimes(1);
    expect(deleteAppointmentsSpy).toHaveBeenCalledWith(expect.anything(), {
      regions: ['02', '03'],
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(deleteAppointmentsSpy.mock.calls[0][0].context).toBe(mockContext);
  });

  test('routes a delete failure to the DLQ and does not call the region driver', async () => {
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const { runRegionDriverSpy } = await setupMocks({
      deleteResult: { data: { deleted: 0 }, error: new Error('delete failed') },
    });

    await handleStart({ regions: ['02'], delete: { from: '2026-08-01' } }, invocationContext);

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
    expect(extraOutputsSetSpy).toHaveBeenCalled();
  });

  test('discards a stale resumeFrom when delete is set so the deleted range is re-walked', async () => {
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy } = await setupMocks();
    const staleResumeFrom = { regionId: '02', date: '2026-08-01', lastId: '1001' };

    await handleStart(
      { regions: ['02'], delete: { from: '2026-08-01' }, resumeFrom: staleResumeFrom },
      invocationContext,
    );

    expect(runRegionDriverSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resumeFrom: undefined }),
    );
  });

  test('flushQueues short-circuits before the region driver is ever called', async () => {
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy } = await setupMocks();

    await handleStart({ regions: ['02'], flushQueues: true }, invocationContext);

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
  });

  test('routes to the DLQ when AzureWebJobsDataflowsStorage is missing', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');

    await handleStart({ regions: ['02'] }, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalled();
  });
});

describe('sync-trustee-case-appointments handleStart fan-out', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  async function setupFanOutMocks(regionIds: string[]) {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(RegionDriverModule.default, 'getAllRegionIds').mockResolvedValue(regionIds);
    const claimRunSpy = vi
      .spyOn(TrusteeAppointmentSyncRun, 'claimRun')
      .mockResolvedValue({ claimed: true, runId: 'run-1' });
    const setLanesRemainingSpy = vi
      .spyOn(TrusteeAppointmentSyncRun, 'setLanesRemaining')
      .mockResolvedValue(undefined);
    const runRegionDriverSpy = vi.spyOn(RegionDriverModule.default, 'runRegionDriver');
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    const fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);
    return {
      mockContext,
      mockSendMessage,
      fromConnectionStringSpy,
      runRegionDriverSpy,
      claimRunSpy,
      setLanesRemainingSpy,
    };
  }

  test('a start message with no regions never calls the region driver directly', async () => {
    const invocationContext = makeInvocationContext();
    const { runRegionDriverSpy } = await setupFanOutMocks(['01', '02', '03']);

    await handleStart({}, invocationContext);

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
  });

  test('fans out every region across lanes with no duplicates or omissions', async () => {
    const invocationContext = makeInvocationContext();
    const regions = ['01', '02', '03', '04', '05', '06', '07', '08'];
    const { mockSendMessage } = await setupFanOutMocks(regions);

    await handleStart({}, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledTimes(4); // LANE_COUNT
    const sentMessages = mockSendMessage.mock.calls.map(([body]) => JSON.parse(body));
    // Which region lands in which lane is lane-assignment.ts's own contract (tested there) --
    // this only asserts fanOutAcrossLanes' own behavior: every region covered exactly once, and
    // each message's laneId is its lane's position in the assignment.
    expect(sentMessages.flatMap((m) => m.regions).sort()).toEqual(regions);
    expect(sentMessages.map((m) => m.laneId)).toEqual([0, 1, 2, 3]);
  });

  test('resolves a default runDate once at kickoff and shares it across every lane message', async () => {
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupFanOutMocks(['01', '02']);
    vi.spyOn(DateHelper, 'getTodaysIsoDate').mockReturnValue('2026-07-05');

    await handleStart({}, invocationContext);

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    const sentMessages = mockSendMessage.mock.calls.map(([body]) => JSON.parse(body));
    expect(sentMessages.map((m) => m.runDate)).toEqual(['2026-07-05', '2026-07-05']);
  });

  test('a delete kickoff deletes once across every region and sends lane messages that do not carry delete', async () => {
    const invocationContext = makeInvocationContext();
    const { mockSendMessage } = await setupFanOutMocks(['01', '02']);
    const deleteAppointmentsSpy = vi
      .spyOn(SyncTrusteeCaseAppointmentsModule.default, 'deleteAppointments')
      .mockResolvedValue({ data: { deleted: 0 } });

    await handleStart({ delete: {}, runDate: '2026-07-05' }, invocationContext);

    expect(deleteAppointmentsSpy).toHaveBeenCalledTimes(1);
    expect(deleteAppointmentsSpy).toHaveBeenCalledWith(expect.anything(), {});
    expect(mockSendMessage.mock.calls.map(([body]) => JSON.parse(body))).toEqual([
      { regions: ['01'], runDate: '2026-07-05', laneId: 0, runId: 'run-1' },
      { regions: ['02'], runDate: '2026-07-05', laneId: 1, runId: 'run-1' },
    ]);
  });

  test('draws a separate jitter delay for each lane message', async () => {
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
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');
    const { mockSendMessage } = await setupFanOutMocks(['01', '02']);
    const startMessage = { resumeFrom: { regionId: '02', date: '2026-08-01' } };

    await handleStart(startMessage, invocationContext);

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'QUEUE_ERROR', startMessage }),
    );
  });

  test('logs the fan-out fallback label when transient retries are exhausted on a kickoff', async () => {
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
});

describe('sync-trustee-case-appointments run lock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  const emptyDriverResult = {
    dlqMessages: [],
    processedRegions: [],
    scenarioDistribution: {} as never,
    retryableEvents: [],
    parkedCount: 0,
  };

  async function setupLockMocks(
    options: {
      claim?: Awaited<ReturnType<typeof TrusteeAppointmentSyncRun.claimRun>>;
      current?: boolean;
      regionIds?: string[];
    } = {},
  ) {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(RegionDriverModule.default, 'getAllRegionIds').mockResolvedValue(
      options.regionIds ?? ['01', '02'],
    );
    const runRegionDriverSpy = vi
      .spyOn(RegionDriverModule.default, 'runRegionDriver')
      .mockResolvedValue(emptyDriverResult);
    const claimRunSpy = vi
      .spyOn(TrusteeAppointmentSyncRun, 'claimRun')
      .mockResolvedValue(options.claim ?? { claimed: true, runId: 'run-1' });
    const isCurrentRunSpy = vi
      .spyOn(TrusteeAppointmentSyncRun, 'isCurrentRun')
      .mockResolvedValue(options.current ?? true);
    const setLanesRemainingSpy = vi
      .spyOn(TrusteeAppointmentSyncRun, 'setLanesRemaining')
      .mockResolvedValue(undefined);
    const completeLaneSpy = vi
      .spyOn(TrusteeAppointmentSyncRun, 'completeLane')
      .mockResolvedValue(undefined);
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);
    return {
      runRegionDriverSpy,
      claimRunSpy,
      isCurrentRunSpy,
      setLanesRemainingSpy,
      completeLaneSpy,
      mockSendMessage,
    };
  }

  const continuation = {
    regions: ['01'],
    runDate: '2026-07-05',
    resumeFrom: { regionId: '01', date: '2026-07-02' },
    cause: 'invocation-budget' as const,
  };

  test('a start with no run id mints one and claims the run with it', async () => {
    const { claimRunSpy } = await setupLockMocks();

    await handleStart({}, makeInvocationContext());

    expect(claimRunSpy).toHaveBeenCalledWith(expect.anything(), expect.any(String));
  });

  test('a kickoff is skipped, with a warning, while another run holds the lock', async () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    vi.spyOn(ApplicationContextCreator, 'getLogger').mockReturnValue(
      logger as unknown as ReturnType<typeof ApplicationContextCreator.getLogger>,
    );
    const { mockSendMessage, runRegionDriverSpy } = await setupLockMocks({
      claim: { claimed: false, activeRunId: 'run-active' },
    });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({}, makeInvocationContext());

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(runRegionDriverSpy).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('run-active'),
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({
        success: true,
        details: { skipped: 'run-active', activeRunId: 'run-active' },
      }),
    );
  });

  test('a kickoff records how many lanes it is sending before it sends any', async () => {
    const { setLanesRemainingSpy, mockSendMessage } = await setupLockMocks({
      regionIds: ['01', '02'],
    });

    await handleStart({}, makeInvocationContext());

    expect(setLanesRemainingSpy).toHaveBeenCalledWith(expect.anything(), 2);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(setLanesRemainingSpy.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendMessage.mock.invocationCallOrder[0],
    );
  });

  test('a kickoff with no regions records zero lanes so the lock is released', async () => {
    const { setLanesRemainingSpy } = await setupLockMocks({ regionIds: [] });

    await handleStart({}, makeInvocationContext());

    expect(setLanesRemainingSpy).toHaveBeenCalledWith(expect.anything(), 0);
  });

  test('a lane message carries the run id the kickoff claimed', async () => {
    const { mockSendMessage } = await setupLockMocks({
      claim: { claimed: true, runId: 'run-7' },
    });

    await handleStart({}, makeInvocationContext());

    const lanes = mockSendMessage.mock.calls.map(([body]) => JSON.parse(body));
    expect(lanes.map((lane) => lane.runId)).toEqual(['run-7', 'run-7']);
  });

  test('a kickoff retry carrying its run id claims with that same id', async () => {
    const { claimRunSpy, isCurrentRunSpy } = await setupLockMocks();

    await handleStart({ runId: 'run-3' }, makeInvocationContext());

    expect(claimRunSpy).toHaveBeenCalledWith(expect.anything(), 'run-3');
    expect(isCurrentRunSpy).not.toHaveBeenCalled();
  });

  test('a kickoff that fails before its claim completes requeues carrying the id it minted', async () => {
    const { claimRunSpy, mockSendMessage } = await setupLockMocks();
    claimRunSpy.mockRejectedValue(new TooManyRequestsError('TEST'));

    await handleStart({}, makeInvocationContext());

    const [body, delay] = mockSendMessage.mock.calls[0];
    const requeued = JSON.parse(body);
    expect(requeued.runId).toEqual(expect.any(String));
    expect(claimRunSpy).toHaveBeenCalledWith(expect.anything(), requeued.runId);
    expect(requeued.transientRetryCount).toBe(1);
    expect(delay).toBe(300);
  });

  test('a lane message of the current run does the work', async () => {
    const { runRegionDriverSpy, isCurrentRunSpy, claimRunSpy } = await setupLockMocks();

    await handleStart({ regions: ['01'], laneId: 0, runId: 'run-1' }, makeInvocationContext());

    expect(isCurrentRunSpy).toHaveBeenCalledWith(expect.anything(), 'run-1');
    expect(claimRunSpy).not.toHaveBeenCalled();
    expect(runRegionDriverSpy).toHaveBeenCalledTimes(1);
  });

  test('a lane message from a run that no longer holds the lock stops without touching any region', async () => {
    const { runRegionDriverSpy, mockSendMessage, completeLaneSpy } = await setupLockMocks({
      current: false,
    });
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart({ regions: ['01'], laneId: 0, runId: 'run-old' }, makeInvocationContext());

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(completeLaneSpy).not.toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleStart',
      expect.anything(),
      expect.objectContaining({
        success: true,
        details: { skipped: 'superseded-run', runId: 'run-old' },
      }),
    );
  });

  test('a lane that finishes with nothing left to continue completes its lane', async () => {
    const { completeLaneSpy } = await setupLockMocks();

    await handleStart({ regions: ['01'], laneId: 0, runId: 'run-1' }, makeInvocationContext());

    expect(completeLaneSpy).toHaveBeenCalledWith(expect.anything(), 'run-1');
  });

  test('a lane that continues carries the run id forward and does not complete its lane', async () => {
    const { runRegionDriverSpy, mockSendMessage, completeLaneSpy } = await setupLockMocks();
    runRegionDriverSpy.mockResolvedValue({ ...emptyDriverResult, continuation });

    await handleStart(
      { regions: ['01'], laneId: 0, runId: 'run-1', runDate: '2026-07-05' },
      makeInvocationContext(),
    );

    const sent = mockSendMessage.mock.calls.map(([body]) => JSON.parse(body));
    expect(sent).toContainEqual(expect.objectContaining({ laneId: 0, runId: 'run-1' }));
    expect(completeLaneSpy).not.toHaveBeenCalled();
  });

  test('a lane whose driver throws a non-transient error keeps the lock held', async () => {
    const { runRegionDriverSpy, completeLaneSpy } = await setupLockMocks();
    runRegionDriverSpy.mockRejectedValue(new Error('boom'));
    const invocationContext = makeInvocationContext();

    await handleStart({ regions: ['01'], laneId: 0, runId: 'run-1' }, invocationContext);

    expect(completeLaneSpy).not.toHaveBeenCalled();
  });

  test('an operator-named start claims the lock like a timer kickoff and completes its single lane', async () => {
    const { runRegionDriverSpy, claimRunSpy, completeLaneSpy } = await setupLockMocks({
      claim: { claimed: true, runId: 'run-op' },
    });

    await handleStart({ regions: ['02'] }, makeInvocationContext());

    expect(claimRunSpy).toHaveBeenCalledTimes(1);
    expect(runRegionDriverSpy).toHaveBeenCalledTimes(1);
    expect(completeLaneSpy).toHaveBeenCalledWith(expect.anything(), 'run-op');
  });

  test('an operator-named start is skipped while another run holds the lock', async () => {
    const { runRegionDriverSpy } = await setupLockMocks({
      claim: { claimed: false, activeRunId: 'run-active' },
    });

    await handleStart({ regions: ['02'] }, makeInvocationContext());

    expect(runRegionDriverSpy).not.toHaveBeenCalled();
  });
});

describe('sync-trustee-case-appointments heal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  async function setupHealMocks(
    page = { healed: 2, stillParked: 1, failed: 0, nextLastId: 'mongo-9' as string | null },
  ) {
    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const healPageSpy = vi
      .spyOn(HealParkedCaseAppointments, 'healParkedPage')
      .mockResolvedValue(page);
    const countAbandonedSpy = vi
      .spyOn(HealParkedCaseAppointments, 'countAbandoned')
      .mockResolvedValue(3);
    const mockSendMessage = vi.fn().mockResolvedValue(undefined);
    const fromConnectionStringSpy = vi
      .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
      .mockReturnValue({ sendMessage: mockSendMessage } as unknown as StorageQueueHumbleObject);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');
    return {
      mockContext,
      healPageSpy,
      countAbandonedSpy,
      mockSendMessage,
      fromConnectionStringSpy,
      telemetrySpy,
    };
  }

  const expectHealTrace = (
    telemetrySpy: ReturnType<typeof vi.spyOn>,
    result: Record<string, unknown>,
  ) =>
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining(result),
    );

  test('the sync timer sends a start message with no region list so the sync fans out across lanes', async () => {
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');

    await timerTrigger({} as never, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledTimes(1);
    expect(extraOutputsSetSpy).toHaveBeenCalledWith(expect.anything(), {});
  });

  test('the heal timer sends a heal start carrying the UTC date it fired', async () => {
    vi.spyOn(DateHelper, 'getTodaysIsoDate').mockReturnValue('2026-11-09');
    const invocationContext = makeInvocationContext();
    const extraOutputsSetSpy = vi.spyOn(invocationContext.extraOutputs, 'set');

    await healTimerTrigger({} as never, invocationContext);

    expect(extraOutputsSetSpy).toHaveBeenCalledTimes(1);
    expect(extraOutputsSetSpy).toHaveBeenCalledWith(expect.anything(), {
      healRunDate: '2026-11-09',
    });
  });

  test('the heal timer records the heal run date in its trace, to correlate with handleHeal traces', async () => {
    vi.spyOn(DateHelper, 'getTodaysIsoDate').mockReturnValue('2026-11-09');
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await healTimerTrigger({} as never, makeInvocationContext());

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-CASE-APPOINTMENTS',
      'healTimerTrigger',
      expect.anything(),
      expect.objectContaining({ details: { healRunDate: '2026-11-09' } }),
    );
  });

  test('the first page counts abandoned rows once and reports the counts', async () => {
    const { healPageSpy, countAbandonedSpy, telemetrySpy } = await setupHealMocks({
      healed: 2,
      stillParked: 1,
      failed: 1,
      nextLastId: 'mongo-9',
    });

    await handleHeal({ healRunDate: '2026-11-09' }, makeInvocationContext());

    expect(countAbandonedSpy).toHaveBeenCalledTimes(1);
    expect(countAbandonedSpy).toHaveBeenCalledWith(expect.anything(), '2026-11-09');
    expect(healPageSpy).toHaveBeenCalledWith(expect.anything(), {
      healRunDate: '2026-11-09',
      lastId: null,
      pageSize: 25,
    });
    expectHealTrace(telemetrySpy, {
      documentsWritten: 2,
      documentsFailed: 1,
      success: true,
      details: expect.objectContaining({
        healedCount: '2',
        stillParkedCount: '1',
        failedCount: '1',
        abandonedCount: '3',
        continuationQueued: 'true',
      }),
      additionalMetrics: expect.arrayContaining([
        { name: 'TrusteeHealedCount', value: 2 },
        { name: 'TrusteeStillParkedCount', value: 1 },
        { name: 'TrusteeAbandonedCount', value: 3 },
      ]),
    });
  });

  test('a continuation page does not count abandoned rows again', async () => {
    const { countAbandonedSpy, healPageSpy, telemetrySpy } = await setupHealMocks();

    await handleHeal({ healRunDate: '2026-11-09', lastId: 'mongo-4' }, makeInvocationContext());

    expect(countAbandonedSpy).not.toHaveBeenCalled();
    expect(healPageSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lastId: 'mongo-4' }),
    );
    expectHealTrace(telemetrySpy, {
      details: expect.not.objectContaining({ abandonedCount: expect.anything() }),
      additionalMetrics: expect.not.arrayContaining([
        expect.objectContaining({ name: 'TrusteeAbandonedCount' }),
      ]),
    });
  });

  test('a non-empty page sends a continuation to the heal queue carrying only the run date and cursor', async () => {
    const { mockSendMessage, fromConnectionStringSpy } = await setupHealMocks();

    await handleHeal(
      {
        healRunDate: '2026-11-09',
        lastId: 'mongo-4',
        retryCount: 2,
        firstAttemptAt: '2026-11-09T18:30:00Z',
      },
      makeInvocationContext(),
    );

    expect(fromConnectionStringSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('-heal'),
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockSendMessage.mock.calls[0][0])).toEqual({
      healRunDate: '2026-11-09',
      lastId: 'mongo-9',
    });
  });

  test('an empty page ends the run with no continuation', async () => {
    const { mockSendMessage } = await setupHealMocks({
      healed: 0,
      stillParked: 0,
      failed: 0,
      nextLastId: null,
    });

    await handleHeal({ healRunDate: '2026-11-09', lastId: 'mongo-9' }, makeInvocationContext());

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('a transient error requeues the page on the heal queue through the rate-limit retry', async () => {
    const { healPageSpy, mockSendMessage, fromConnectionStringSpy, telemetrySpy } =
      await setupHealMocks();
    healPageSpy.mockRejectedValue(new TooManyRequestsError('TEST'));

    await handleHeal({ healRunDate: '2026-11-09' }, makeInvocationContext());

    expect(fromConnectionStringSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('-heal'),
    );
    expect(JSON.parse(mockSendMessage.mock.calls[0][0])).toEqual(
      expect.objectContaining({ healRunDate: '2026-11-09', retryCount: 1 }),
    );
    expectHealTrace(telemetrySpy, { success: false, error: 'rate-limited-requeued' });
  });

  test('routes the page to the DLQ once the rate-limit retry limit is exhausted', async () => {
    const { mockContext, healPageSpy, telemetrySpy } = await setupHealMocks();
    healPageSpy.mockRejectedValue(new TooManyRequestsError('TEST'));
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');

    await handleHeal({ healRunDate: '2026-11-09', retryCount: 10 }, makeInvocationContext());

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
    expectHealTrace(telemetrySpy, {
      success: false,
      documentsFailed: 1,
      error: 'rate-limit-retry-exhausted',
    });
  });

  test('rethrows a non-transient error', async () => {
    const { healPageSpy } = await setupHealMocks();
    healPageSpy.mockRejectedValue(new CamsError('TEST', { message: 'boom' }));

    await expect(
      handleHeal({ healRunDate: '2026-11-09' }, makeInvocationContext()),
    ).rejects.toThrow('boom');
  });

  test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;

    await expect(
      handleHeal({ healRunDate: '2026-11-09' }, makeInvocationContext()),
    ).rejects.toThrow('Missing required environment variable: AzureWebJobsDataflowsStorage');
  });
});
