import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import SyncTrusteeAppointments from '../../../lib/use-cases/dataflows/sync-trustee-appointments';
import * as dataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncErrorCode,
  TrusteeAppointmentSyncEvent,
} from '@common/cams/dataflow-events';
import syncTrusteeAppointmentsHandler from './sync-trustee-appointments';

const { AUTO_MATCHED, REVIEW_DLQ, FAILURES_DLQ, DLQ } = syncTrusteeAppointmentsHandler;

const makeEvent = (caseId: string): TrusteeAppointmentSyncEvent => ({
  caseId,
  courtId: '081',
  dxtrTrustee: { fullName: 'John Doe' },
});

const makeDlqError = (
  caseId: string,
  mismatchReason: TrusteeAppointmentSyncErrorCode,
): TrusteeAppointmentSyncError => ({
  caseId,
  courtId: '081',
  dxtrTrustee: { fullName: 'John Doe' },
  mismatchReason,
  matchCandidates: [],
});

const emptyDistribution = {
  autoMatchCount: 0,
  imperfectMatchCount: 0,
  highConfidenceMatchCount: 0,
  noMatchCount: 0,
  multipleMatchCount: 0,
  caseNotFoundCount: 0,
};

describe('sync-trustee-appointments handlePage routing', () => {
  let setSpy: ReturnType<typeof vi.fn>;
  let invocationContext: InvocationContext;

  beforeEach(async () => {
    setSpy = vi.fn();
    invocationContext = {
      invocationId: 'test-invocation-id',
      extraOutputs: { set: setSpy },
    } as unknown as InvocationContext;

    vi.spyOn(ContextCreator, 'getApplicationContext').mockResolvedValue({
      observability: {
        startTrace: vi.fn().mockReturnValue({ traceId: 'test-trace' }),
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    } as never);

    vi.spyOn(dataflowTelemetry, 'completeDataflowTrace').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('routes auto-matched events to AUTO_MATCHED queue', async () => {
    const event = makeEvent('case-001');
    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 1,
      autoMatchedEvents: [event],
      dlqMessages: [],
      scenarioDistribution: { ...emptyDistribution, autoMatchCount: 1 },
    });

    await syncTrusteeAppointmentsHandler.handlePage([event], invocationContext);

    expect(setSpy).toHaveBeenCalledWith(AUTO_MATCHED, [event]);
  });

  test('routes IMPERFECT_MATCH messages to REVIEW_DLQ queue', async () => {
    const dlqMsg = makeDlqError('case-001', 'IMPERFECT_MATCH');
    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 0,
      autoMatchedEvents: [],
      dlqMessages: [dlqMsg],
      scenarioDistribution: { ...emptyDistribution, imperfectMatchCount: 1 },
    });

    await syncTrusteeAppointmentsHandler.handlePage([makeEvent('case-001')], invocationContext);

    expect(setSpy).toHaveBeenCalledWith(REVIEW_DLQ, [dlqMsg]);
  });

  test('routes HIGH_CONFIDENCE_MATCH messages to REVIEW_DLQ queue', async () => {
    const dlqMsg = makeDlqError('case-001', 'HIGH_CONFIDENCE_MATCH');
    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 0,
      autoMatchedEvents: [],
      dlqMessages: [dlqMsg],
      scenarioDistribution: { ...emptyDistribution, highConfidenceMatchCount: 1 },
    });

    await syncTrusteeAppointmentsHandler.handlePage([makeEvent('case-001')], invocationContext);

    expect(setSpy).toHaveBeenCalledWith(REVIEW_DLQ, [dlqMsg]);
  });

  test('routes MULTIPLE_TRUSTEES_MATCH messages to FAILURES_DLQ queue', async () => {
    const dlqMsg = makeDlqError('case-001', 'MULTIPLE_TRUSTEES_MATCH');
    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 0,
      autoMatchedEvents: [],
      dlqMessages: [dlqMsg],
      scenarioDistribution: { ...emptyDistribution, multipleMatchCount: 1 },
    });

    await syncTrusteeAppointmentsHandler.handlePage([makeEvent('case-001')], invocationContext);

    expect(setSpy).toHaveBeenCalledWith(FAILURES_DLQ, [dlqMsg]);
  });

  test('routes NO_TRUSTEE_MATCH messages to FAILURES_DLQ queue', async () => {
    const dlqMsg = makeDlqError('case-001', 'NO_TRUSTEE_MATCH');
    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 0,
      autoMatchedEvents: [],
      dlqMessages: [dlqMsg],
      scenarioDistribution: { ...emptyDistribution, noMatchCount: 1 },
    });

    await syncTrusteeAppointmentsHandler.handlePage([makeEvent('case-001')], invocationContext);

    expect(setSpy).toHaveBeenCalledWith(FAILURES_DLQ, [dlqMsg]);
  });

  test('routes CASE_NOT_FOUND messages to FAILURES_DLQ queue', async () => {
    const dlqMsg = makeDlqError('case-001', 'CASE_NOT_FOUND');
    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 0,
      autoMatchedEvents: [],
      dlqMessages: [dlqMsg],
      scenarioDistribution: { ...emptyDistribution, caseNotFoundCount: 1 },
    });

    await syncTrusteeAppointmentsHandler.handlePage([makeEvent('case-001')], invocationContext);

    expect(setSpy).toHaveBeenCalledWith(FAILURES_DLQ, [dlqMsg]);
  });

  test('routes unclassified errors to existing DLQ', async () => {
    const errorMsg: TrusteeAppointmentSyncEvent = {
      ...makeEvent('case-001'),
      error: new Error('unexpected'),
    };
    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 0,
      autoMatchedEvents: [],
      dlqMessages: [errorMsg],
      scenarioDistribution: emptyDistribution,
    });

    await syncTrusteeAppointmentsHandler.handlePage([makeEvent('case-001')], invocationContext);

    expect(setSpy).toHaveBeenCalledWith(DLQ, [errorMsg]);
  });

  test('does not call extraOutputs.set for empty queues', async () => {
    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 0,
      autoMatchedEvents: [],
      dlqMessages: [],
      scenarioDistribution: emptyDistribution,
    });

    await syncTrusteeAppointmentsHandler.handlePage([], invocationContext);

    expect(setSpy).not.toHaveBeenCalled();
  });

  test('mixed batch routes each message to correct queue', async () => {
    const autoEvent = makeEvent('case-auto');
    const reviewMsg = makeDlqError('case-review', 'IMPERFECT_MATCH');
    const failureMsg = makeDlqError('case-failure', 'NO_TRUSTEE_MATCH');
    const errorMsg: TrusteeAppointmentSyncEvent = {
      ...makeEvent('case-error'),
      error: new Error('boom'),
    };

    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 1,
      autoMatchedEvents: [autoEvent],
      dlqMessages: [reviewMsg, failureMsg, errorMsg],
      scenarioDistribution: {
        ...emptyDistribution,
        autoMatchCount: 1,
        imperfectMatchCount: 1,
        noMatchCount: 1,
      },
    });

    await syncTrusteeAppointmentsHandler.handlePage(
      [
        makeEvent('case-auto'),
        makeEvent('case-review'),
        makeEvent('case-failure'),
        makeEvent('case-error'),
      ],
      invocationContext,
    );

    expect(setSpy).toHaveBeenCalledWith(AUTO_MATCHED, [autoEvent]);
    expect(setSpy).toHaveBeenCalledWith(REVIEW_DLQ, [reviewMsg]);
    expect(setSpy).toHaveBeenCalledWith(FAILURES_DLQ, [failureMsg]);
    expect(setSpy).toHaveBeenCalledWith(DLQ, [errorMsg]);
  });

  test('telemetry details include per-queue counts', async () => {
    const autoEvent = makeEvent('case-auto');
    const reviewMsg = makeDlqError('case-review', 'IMPERFECT_MATCH');
    const failureMsg = makeDlqError('case-failure', 'NO_TRUSTEE_MATCH');

    vi.spyOn(SyncTrusteeAppointments, 'processAppointments').mockResolvedValue({
      successCount: 1,
      autoMatchedEvents: [autoEvent],
      dlqMessages: [reviewMsg, failureMsg],
      scenarioDistribution: {
        ...emptyDistribution,
        autoMatchCount: 1,
        imperfectMatchCount: 1,
        noMatchCount: 1,
      },
    });

    const traceSpy = vi.spyOn(dataflowTelemetry, 'completeDataflowTrace');

    await syncTrusteeAppointmentsHandler.handlePage(
      [makeEvent('a'), makeEvent('b'), makeEvent('c')],
      invocationContext,
    );

    const traceCallArg = traceSpy.mock.calls[0][5];
    expect(traceCallArg.details).toEqual(
      expect.objectContaining({
        autoMatchedCount: '1',
        reviewCount: '1',
        failureCount: '1',
      }),
    );
  });
});
