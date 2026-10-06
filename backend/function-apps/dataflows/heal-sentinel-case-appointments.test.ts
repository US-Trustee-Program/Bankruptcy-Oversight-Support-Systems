import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../azure/application-context-creator';
import { createMockApplicationContext } from '../../lib/testing/testing-utilities';
import HealSentinelCaseAppointmentsUseCase from '../../lib/use-cases/dataflows/heal-sentinel-case-appointments';
import {
  HealSentinelCaseAppointmentsMessage,
  HealSentinelProfessionalId,
} from '@common/cams/dataflow-events';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'heal-sentinel-case-appointments',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const inProgress: HealSentinelProfessionalId = {
  professionalIdDocId: 'prof-mongo-1',
  camsTrusteeId: 'trustee-resolved',
  acmsProfessionalId: 'NY-00063',
  lastAppointmentId: 'appt-mongo-9',
};

describe('heal-sentinel-case-appointments handleHeal', () => {
  let mockHealNext: ReturnType<typeof vi.spyOn>;
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let telemetrySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';

    mockHealNext = vi
      .spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'healNext')
      .mockResolvedValue({ documentsWritten: 0, documentsFailed: 0, pageSize: 0, next: null });
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);
    telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');
  });

  test('starts a run from an empty message', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');

    await handleHeal({}, makeInvocationContext());

    expect(mockHealNext).toHaveBeenCalledWith(
      { lastProfessionalIdDocId: null, current: null },
      expect.any(Number),
    );
  });

  test('requeues only the returned cursor, dropping rate-limit retry state from the incoming message', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    const next = { lastProfessionalIdDocId: 'prof-mongo-0', current: inProgress };
    mockHealNext.mockResolvedValue({ documentsWritten: 3, documentsFailed: 1, pageSize: 4, next });
    const message: HealSentinelCaseAppointmentsMessage = {
      lastProfessionalIdDocId: 'prof-mongo-0',
      current: { ...inProgress, lastAppointmentId: 'appt-mongo-5' },
      retryCount: 2,
      firstAttemptAt: '2026-10-06T00:00:00.000Z',
    };

    await handleHeal(message, makeInvocationContext());

    expect(mockHealNext).toHaveBeenCalledWith(
      { lastProfessionalIdDocId: 'prof-mongo-0', current: message.current },
      expect.any(Number),
    );
    expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(next));
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'HEAL-SENTINEL-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining({
        success: true,
        documentsWritten: 3,
        documentsFailed: 1,
        details: { pageSize: '4', continuationQueued: 'true' },
      }),
    );
  });

  test('does not requeue when the run is finished', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');

    await handleHeal({}, makeInvocationContext());

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'HEAL-SENTINEL-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining({
        success: true,
        details: { pageSize: '0', continuationQueued: 'false' },
      }),
    );
  });

  test('should re-enqueue with backoff and emit rate-limited-requeued telemetry on 429 error', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    mockHealNext.mockRejectedValue(new TooManyRequestsError('HEAL-SENTINEL-CASE-APPOINTMENTS'));

    await handleHeal({ retryCount: 0 }, makeInvocationContext());

    expect(mockSendMessage).toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'HEAL-SENTINEL-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
  });

  test('should route to DLQ and emit telemetry when retry limit exhausted', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    mockHealNext.mockRejectedValue(new TooManyRequestsError('HEAL-SENTINEL-CASE-APPOINTMENTS'));
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

    await handleHeal({ retryCount: 10 }, makeInvocationContext());

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'HEAL-SENTINEL-CASE-APPOINTMENTS',
      'handleHeal',
      expect.anything(),
      expect.objectContaining({
        success: false,
        documentsFailed: 1,
        error: 'rate-limit-retry-exhausted',
      }),
    );
  });

  test('rethrows non-rate-limit errors', async () => {
    const { handleHeal } = await import('./heal-sentinel-case-appointments');
    mockHealNext.mockRejectedValue(new Error('boom'));

    await expect(handleHeal({}, makeInvocationContext())).rejects.toThrow('boom');
  });

  test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const { handleHeal } = await import('./heal-sentinel-case-appointments');

    await expect(handleHeal({}, makeInvocationContext())).rejects.toThrow(
      'Missing required environment variable: AzureWebJobsDataflowsStorage',
    );
  });
});
