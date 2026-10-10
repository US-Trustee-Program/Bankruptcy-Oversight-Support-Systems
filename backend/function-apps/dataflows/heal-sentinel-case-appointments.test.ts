import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../lib/use-cases/dataflows/dataflow-telemetry';
import * as RateLimit from './dataflows-rate-limit';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../azure/application-context-creator';
import { createMockApplicationContext } from '../../lib/testing/testing-utilities';
import HealSentinelCaseAppointmentsUseCase from '../../lib/use-cases/dataflows/heal-sentinel-case-appointments';
import { HealSentinelCaseAppointmentsPageMessage } from '@common/cams/dataflow-events';

const makeInvocationContext = () => {
  const extraOutputs = new Map<unknown, unknown>();
  const invocationContext = {
    invocationId: 'test-id',
    functionName: 'heal-sentinel-case-appointments',
    extraOutputs,
    log: vi.fn(),
  } as unknown as InvocationContext;
  const queued = (queueName: string) =>
    [...extraOutputs.entries()].find(
      ([output]) => (output as { queueName: string }).queueName === queueName,
    )?.[1];
  return { invocationContext, queued };
};

const page: HealSentinelCaseAppointmentsPageMessage = {
  trusteeProfessionalId: 'prof-id-1',
  camsTrusteeId: 'trustee-resolved',
  acmsProfessionalId: 'NY-00063',
};

const PAGE_QUEUE = 'heal-sentinel-case-appointments-page';

describe('heal-sentinel-case-appointments handlers', () => {
  let telemetrySpy: ReturnType<typeof vi.spyOn>;
  let mockSendMessage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    mockSendMessage = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);
    telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');
  });

  describe('handleStart', () => {
    test('queues one page per linked record', async () => {
      const { handleStart } = await import('./heal-sentinel-case-appointments');
      const startSpy = vi
        .spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'startPages')
        .mockResolvedValue([page, { ...page, trusteeProfessionalId: 'prof-id-2' }]);
      const { invocationContext, queued } = makeInvocationContext();

      await handleStart({}, invocationContext);

      expect(startSpy).toHaveBeenCalledWith(false);
      expect(queued(PAGE_QUEUE)).toEqual([page, { ...page, trusteeProfessionalId: 'prof-id-2' }]);
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'HEAL-SENTINEL-CASE-APPOINTMENTS',
        'handleStart',
        expect.anything(),
        expect.objectContaining({ success: true, details: { pagesQueued: '2' } }),
      );
    });

    test('includes already-healed records when the start message says to ignore the flag', async () => {
      const { handleStart } = await import('./heal-sentinel-case-appointments');
      const startSpy = vi
        .spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'startPages')
        .mockResolvedValue([]);
      const { invocationContext, queued } = makeInvocationContext();

      await handleStart({ ignoreSentinelsHealedOn: true }, invocationContext);

      expect(startSpy).toHaveBeenCalledWith(true);
      expect(queued(PAGE_QUEUE)).toBeUndefined();
    });
    test('records a rate limit that escapes the start', async () => {
      const { handleStart } = await import('./heal-sentinel-case-appointments');
      vi.spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'startPages').mockRejectedValue(
        new Error('throttled'),
      );
      vi.spyOn(RateLimit, 'handleRateLimitRetry').mockResolvedValue('retried');

      await handleStart({}, makeInvocationContext().invocationContext);

      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'HEAL-SENTINEL-CASE-APPOINTMENTS',
        'handleStart',
        expect.anything(),
        expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
      );
    });

    test('rethrows a start error that is not a rate limit', async () => {
      const { handleStart } = await import('./heal-sentinel-case-appointments');
      vi.spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'startPages').mockRejectedValue(
        new Error('boom'),
      );

      await expect(handleStart({}, makeInvocationContext().invocationContext)).rejects.toThrow(
        'boom',
      );
    });
  });

  describe('handlePage', () => {
    test('heals a page of up to 1000 sentinels with a deadline 30 seconds short of the one-hour limit', async () => {
      const { handlePage } = await import('./heal-sentinel-case-appointments');
      vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
      const healSpy = vi
        .spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'healPage')
        .mockResolvedValue({
          documentsWritten: 0,
          documentsFailed: 0,
          pageSize: 0,
          outcome: 'done',
          delaySeconds: 0,
          next: null,
        });

      await handlePage(page, makeInvocationContext().invocationContext);

      expect(healSpy).toHaveBeenCalledWith(page, 1_000_000 + 59.5 * 60 * 1000, 1000);
    });

    test('requeues the next page after a full pass', async () => {
      const { handlePage } = await import('./heal-sentinel-case-appointments');
      const next = { ...page, lastAppointmentId: 'appt-mongo-0999' };
      vi.spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'healPage').mockResolvedValue({
        documentsWritten: 998,
        documentsFailed: 2,
        pageSize: 1000,
        outcome: 'requeued',
        delaySeconds: 0,
        next,
      });
      const { invocationContext, queued } = makeInvocationContext();

      await handlePage(page, invocationContext);

      expect(queued(PAGE_QUEUE)).toEqual(next);
      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'HEAL-SENTINEL-CASE-APPOINTMENTS',
        'handlePage',
        expect.anything(),
        expect.objectContaining({
          success: true,
          documentsWritten: 998,
          documentsFailed: 2,
          details: { pageSize: '1000', outcome: 'requeued' },
        }),
      );
    });

    test('does not requeue a finished record', async () => {
      const { handlePage } = await import('./heal-sentinel-case-appointments');
      vi.spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'healPage').mockResolvedValue({
        documentsWritten: 0,
        documentsFailed: 0,
        pageSize: 0,
        outcome: 'done',
        delaySeconds: 0,
        next: null,
      });
      const { invocationContext, queued } = makeInvocationContext();

      await handlePage(page, invocationContext);

      expect(queued(PAGE_QUEUE)).toBeUndefined();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    test.each([
      { random: 0, visibility: 32 },
      { random: 0.9999, visibility: 62 },
    ])(
      'requeues an escaped page on the page queue with its backoff plus jitter ($visibility s)',
      async ({ random, visibility }) => {
        const { handlePage } = await import('./heal-sentinel-case-appointments');
        const next = { ...page, lastAppointmentId: 'appt-mongo-0412' };
        vi.spyOn(Math, 'random').mockReturnValue(random);
        vi.spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'healPage').mockResolvedValue({
          documentsWritten: 412,
          documentsFailed: 0,
          pageSize: 1000,
          outcome: 'escaped',
          delaySeconds: 32,
          next,
        });
        const { invocationContext, queued } = makeInvocationContext();

        await handlePage(page, invocationContext);

        expect(queued(PAGE_QUEUE)).toBeUndefined();
        expect(StorageQueueHumbleObject.fromConnectionString).toHaveBeenCalledWith(
          expect.any(String),
          PAGE_QUEUE,
        );
        expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(next), visibility);
      },
    );

    test.each([
      { status: 'retried' as const, error: 'rate-limited-requeued', documentsFailed: 0 },
      { status: 'exhausted' as const, error: 'rate-limit-retry-exhausted', documentsFailed: 1 },
    ])(
      'records $error when a rate limit escapes the page',
      async ({ status, error, documentsFailed }) => {
        const { handlePage } = await import('./heal-sentinel-case-appointments');
        vi.spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'healPage').mockRejectedValue(
          new Error('throttled'),
        );
        vi.spyOn(RateLimit, 'handleRateLimitRetry').mockResolvedValue(status);

        await handlePage(page, makeInvocationContext().invocationContext);

        expect(telemetrySpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          'HEAL-SENTINEL-CASE-APPOINTMENTS',
          'handlePage',
          expect.anything(),
          expect.objectContaining({ success: false, error, documentsFailed }),
        );
      },
    );

    test('rethrows non-rate-limit errors', async () => {
      const { handlePage } = await import('./heal-sentinel-case-appointments');
      vi.spyOn(HealSentinelCaseAppointmentsUseCase.prototype, 'healPage').mockRejectedValue(
        new Error('boom'),
      );

      await expect(handlePage(page, makeInvocationContext().invocationContext)).rejects.toThrow(
        'boom',
      );
    });

    test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;
      const { handlePage } = await import('./heal-sentinel-case-appointments');

      await expect(handlePage(page, makeInvocationContext().invocationContext)).rejects.toThrow(
        'Missing required environment variable: AzureWebJobsDataflowsStorage',
      );
    });
  });
});
