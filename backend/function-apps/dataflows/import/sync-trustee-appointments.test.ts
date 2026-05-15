import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as SyncTrusteeAppointmentsModule from '../../../lib/use-cases/dataflows/sync-trustee-appointments';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'sync-trustee-appointments',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeTrusteeEvent = (caseId: string): TrusteeAppointmentSyncEvent =>
  ({
    type: 'TRUSTEE_APPOINTMENT',
    caseId,
  }) as TrusteeAppointmentSyncEvent;

const makeEmptyScenarioDistribution = () => ({
  autoMatchCount: 0,
  imperfectMatchCount: 0,
  highConfidenceMatchCount: 0,
  noMatchCount: 0,
  multipleMatchCount: 0,
  reVerificationCount: 0,
});

describe('sync-trustee-appointments handlePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
  });

  test('should process events and emit success telemetry', async () => {
    const { handlePage } = await import('./sync-trustee-appointments');
    const events = [makeTrusteeEvent('001-25-00001'), makeTrusteeEvent('001-25-00002')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    const processResult = {
      successCount: 2,
      dlqMessages: [],
      scenarioDistribution: makeEmptyScenarioDistribution(),
    };
    vi.spyOn(SyncTrusteeAppointmentsModule.default, 'processAppointments').mockResolvedValue(
      processResult,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    expect(SyncTrusteeAppointmentsModule.default.processAppointments).toHaveBeenCalledWith(
      expect.anything(),
      events,
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 2, documentsFailed: 0 }),
    );
  });

  test('should re-enqueue with backoff on 429 error', async () => {
    const { handlePage } = await import('./sync-trustee-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events, retryCount: 0 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-TRUSTEE-APPOINTMENTS');
    vi.spyOn(SyncTrusteeAppointmentsModule.default, 'processAppointments').mockRejectedValue(
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

    expect(mockSendMessage).toHaveBeenCalled();
  });

  test('should emit rate-limited-requeued telemetry on 429 retry', async () => {
    const { handlePage } = await import('./sync-trustee-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events, retryCount: 0 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-TRUSTEE-APPOINTMENTS');
    vi.spyOn(SyncTrusteeAppointmentsModule.default, 'processAppointments').mockRejectedValue(
      tooManyError,
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
      'SYNC-TRUSTEE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handlePage } = await import('./sync-trustee-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events, retryCount: 10 };
    const invocationContext = makeInvocationContext();

    const tooManyError = new TooManyRequestsError('SYNC-TRUSTEE-APPOINTMENTS');
    vi.spyOn(SyncTrusteeAppointmentsModule.default, 'processAppointments').mockRejectedValue(
      tooManyError,
    );
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handlePage(message, invocationContext);

    const outputs = Array.from(
      (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
    );
    const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
    expect(dlqOutput).toBeDefined();

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'SYNC-TRUSTEE-APPOINTMENTS',
      'handlePage',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limit-retry-exhausted' }),
    );
  });

  test('should re-throw on non-429 error', async () => {
    const { handlePage } = await import('./sync-trustee-appointments');
    const events = [makeTrusteeEvent('001-25-00001')];
    const message = { events };
    const invocationContext = makeInvocationContext();

    const error = new CamsError('SYNC-TRUSTEE-APPOINTMENTS', { message: 'Database error' });
    vi.spyOn(SyncTrusteeAppointmentsModule.default, 'processAppointments').mockRejectedValue(error);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );

    await expect(handlePage(message, invocationContext)).rejects.toThrow('Database error');
  });
});
