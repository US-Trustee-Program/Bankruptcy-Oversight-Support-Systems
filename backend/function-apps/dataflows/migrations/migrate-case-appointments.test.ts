import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as StorageQueue from '@azure/storage-queue';
import MigrateCaseAppointmentsUseCase from '../../../lib/use-cases/dataflows/migrate-case-appointments';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as StorageQueueHumbleModule from '../../../lib/humble-objects/storage-queue-humble';
import type {
  MigrateCaseAppointmentsStartMessage,
  MigrateCaseAppointmentsPageMessage,
} from './migrate-case-appointments';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-invocation-id',
    functionName: 'migrate-case-appointments-handleStart',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeResolvedRecord = (id = 1001) => ({
  id,
  caseId: '081-24-12345',
  acmsProfessionalId: 'NY-00063',
  assignDate: 20200101,
  apptDate: 20200101,
  unassignDate: null,
  caseFiledDate: 20190110,
  chapter: '7',
  courtDivisionCode: '081',
  closedByCourtDate: null,
  closedByUstDate: null,
  reopenedDate: null,
  trusteeId: 'trustee-001',
});

const MOCK_STATE = {
  documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE' as const,
  lastId: null,
  processedCount: 0,
  failedCount: 0,
  reEnqueuedCount: 0,
  acmsQueryRetries: 0,
  resumeAttempts: 0,
  readingCompleted: false,
  startedAt: '2025-01-01T00:00:00.000Z',
  lastUpdatedAt: '2025-01-02T00:00:00.000Z',
  status: 'IN_PROGRESS' as const,
};

describe('migrate-case-appointments', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    delete process.env.AzureWebJobsDataflowsStorage;
    process.env.DATABASE_MOCK = 'true';

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockReturnValue(undefined);
  });

  describe('handleStart — resume', () => {
    test('enqueues continuation from existing lastId without resetting state', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: { ...MOCK_STATE, lastId: 5000, processedCount: 50000, status: 'IN_PROGRESS' },
      });

      await handleStart({ resume: true }, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const resumeMsg = outputs.find(
        (v) => typeof v === 'object' && v !== null && (v as { lastId?: unknown }).lastId === 5000,
      );
      expect(resumeMsg).toBeDefined();
    });

    test('is a no-op when migration is already COMPLETED', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: { ...MOCK_STATE, status: 'COMPLETED' },
      });

      await handleStart({ resume: true }, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
    });

    test('is a no-op when no state exists', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: null,
      });

      await handleStart({ resume: true }, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
    });
  });

  describe('handleStart — fresh start (no lastId)', () => {
    test('resets state and enqueues first continuation without calling deleteAllBySource', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      const updateSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState')
        .mockResolvedValue({ data: MOCK_STATE });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'reindexPhase').mockResolvedValue({
        status: 'ready',
      });

      await handleStart({} as MigrateCaseAppointmentsStartMessage, invocationContext);

      // Fresh start writes IN_PROGRESS with zeroed counters
      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lastId: null, status: 'IN_PROGRESS' }),
      );
    });

    test('enqueues continuation { lastId: null } to START queue after reset', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'reindexPhase').mockResolvedValue({
        status: 'ready',
      });

      await handleStart({} as MigrateCaseAppointmentsStartMessage, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).entries()];
      const startOutput = outputs.find(([, v]) => {
        const val = v as { lastId?: unknown };
        return typeof val === 'object' && val !== null && 'lastId' in val && val.lastId === null;
      });
      expect(startOutput).toBeDefined();
    });

    test('re-enqueues self with 60s visibility delay when reindexPhase returns needs-polling', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'reindexPhase').mockResolvedValue({
        status: 'needs-polling',
      });

      const sendMessageSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(
        StorageQueueHumbleModule.StorageQueueHumbleObject,
        'fromConnectionString',
      ).mockReturnValue({
        sendMessage: sendMessageSpy,
      } as unknown as ReturnType<
        typeof StorageQueueHumbleModule.StorageQueueHumbleObject.fromConnectionString
      >);
      process.env.AzureWebJobsDataflowsStorage = 'UseDevelopmentStorage=true';

      await handleStart({} as MigrateCaseAppointmentsStartMessage, invocationContext);

      expect(sendMessageSpy).toHaveBeenCalledOnce();
      const [, visibilityTimeout] = sendMessageSpy.mock.calls[0];
      expect(visibilityTimeout).toBe(60);

      // No ACMS reads or PAGE writes
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const pageMessages = outputs.filter((v) => Array.isArray(v));
      expect(pageMessages).toHaveLength(0);

      delete process.env.AzureWebJobsDataflowsStorage;
    });
  });

  describe('handleStart — continuation (lastId present)', () => {
    test('reads from ACMS, chunks, enqueues to PAGE queue and self-enqueues next cursor', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      const records = Array.from({ length: 300 }, (_, i) => makeResolvedRecord(i + 1));
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockResolvedValue({
        records,
        nextLastId: 300,
        isEmpty: false,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });

      await handleStart({ lastId: 0 } as MigrateCaseAppointmentsStartMessage, invocationContext);

      // 300 records / 100 per batch = 3 PAGE messages
      const allOutputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).entries()];
      const pageMessages = allOutputs
        .filter(([, v]) => Array.isArray(v))
        .flatMap(([, v]) => v as string[]);
      expect(pageMessages).toHaveLength(3);
      pageMessages.forEach((msg) => {
        const parsed = JSON.parse(msg) as MigrateCaseAppointmentsPageMessage;
        expect(parsed.records).toBeDefined();
      });
    });

    test('marks COMPLETED when readPage returns isEmpty', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockResolvedValue({
        records: [],
        nextLastId: null,
        isEmpty: true,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: { ...MOCK_STATE },
      });
      const updateSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState')
        .mockResolvedValue({ data: MOCK_STATE });

      await handleStart({ lastId: 999 } as MigrateCaseAppointmentsStartMessage, invocationContext);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'COMPLETED', readingCompleted: true }),
        expect.anything(), // prefetchedState passed to avoid re-read
      );
    });

    test('retries on transient SQL timeout up to 3 attempts', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockRejectedValue(
        new Error('Timeout: Request failed to complete in 90000ms'),
      );

      await handleStart(
        { lastId: 100, attempt: 1 } as MigrateCaseAppointmentsStartMessage,
        invocationContext,
      );

      // Should re-enqueue with attempt: 2, not DLQ
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const retryMsg = outputs.find(
        (v) => typeof v === 'object' && v !== null && (v as { attempt?: number }).attempt === 2,
      );
      expect(retryMsg).toBeDefined();
    });

    test('retries on attempt 3 (last allowed retry)', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockRejectedValue(
        new Error('Timeout: Request failed to complete in 90000ms'),
      );

      await handleStart(
        { lastId: 100, attempt: 3 } as MigrateCaseAppointmentsStartMessage,
        invocationContext,
      );

      // attempt 3 should still retry (enqueue attempt 4), not DLQ
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const retryMsg = outputs.find(
        (v) => typeof v === 'object' && v !== null && (v as { attempt?: number }).attempt === 4,
      );
      expect(retryMsg).toBeDefined();
    });

    test('sends to DLQ only after 4th failed attempt (retries exhausted)', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockRejectedValue(
        new Error('Timeout: Request failed to complete in 90000ms'),
      );
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });

      await handleStart(
        { lastId: 100, attempt: 4 } as MigrateCaseAppointmentsStartMessage,
        invocationContext,
      );

      // Observable outcome: DLQ receives an error message and state is marked FAILED
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const dlqOutput = outputs.find((v) => {
        if (typeof v !== 'object' || v === null) return false;
        const msg = v as Record<string, unknown>;
        return 'module' in msg || 'error' in msg;
      });
      expect(dlqOutput).toBeDefined();
      expect(MigrateCaseAppointmentsUseCase.updateMigrationState).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'FAILED' }),
        expect.anything(),
      );
    });

    test('aborts without calling readPage when migration status is FAILED', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: { ...MOCK_STATE, status: 'FAILED' },
      });
      const readPageSpy = vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage');

      await handleStart({ lastId: 100 } as MigrateCaseAppointmentsStartMessage, invocationContext);

      expect(readPageSpy).not.toHaveBeenCalled();
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
    });
  });

  describe('handleStart — halt', () => {
    test('sets status=FAILED, purges queues, and does not enqueue continuation', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      process.env.AzureWebJobsDataflowsStorage = 'UseDevelopmentStorage=true';
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: { ...MOCK_STATE, lastId: 5000, processedCount: 50000, status: 'IN_PROGRESS' },
      });
      const updateSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState')
        .mockResolvedValue({ data: MOCK_STATE });

      const mockClearMessages = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(StorageQueue.QueueServiceClient, 'fromConnectionString').mockReturnValue({
        getQueueClient: vi.fn().mockReturnValue({ clearMessages: mockClearMessages }),
      } as unknown as StorageQueue.QueueServiceClient);

      await handleStart({ halt: true }, invocationContext);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'FAILED' }),
      );
      expect(mockClearMessages).toHaveBeenCalledTimes(2);
      // No continuation or DLQ enqueued
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
    });
  });

  describe('handleStart — flushQueues', () => {
    test('dumps queues to blobs and returns without starting migration', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      const mockReceiveMessages = vi.fn().mockResolvedValue({ receivedMessageItems: [] });
      vi.spyOn(StorageQueue.QueueServiceClient, 'fromConnectionString').mockReturnValue({
        getQueueClient: vi.fn().mockReturnValue({ receiveMessages: mockReceiveMessages }),
      } as unknown as StorageQueue.QueueServiceClient);
      const readStateSpy = vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState');

      const factoryModule = (await import('../../../lib/factory')).default;
      vi.spyOn(factoryModule, 'getObjectStorageGateway').mockReturnValue({
        writeObject: vi.fn(),
        readObject: vi.fn(),
      });

      await handleStart(
        { flushQueues: true } as MigrateCaseAppointmentsStartMessage,
        invocationContext,
      );

      expect(readStateSpy).not.toHaveBeenCalled();
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs).toHaveLength(0);
    });
  });

  describe('handlePage — Cosmos writer', () => {
    test('discards write batch when migration status is FAILED', async () => {
      const { handlePage } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: { ...MOCK_STATE, status: 'FAILED' },
      });
      const writePageSpy = vi.spyOn(MigrateCaseAppointmentsUseCase, 'writePage');

      const records = Array.from({ length: 50 }, (_, i) => makeResolvedRecord(i + 1));
      await handlePage({ records } as MigrateCaseAppointmentsPageMessage, invocationContext);

      expect(writePageSpy).not.toHaveBeenCalled();
    });

    test('calls writePage and increments processedCount in state', async () => {
      const { handlePage } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'writePage').mockResolvedValue({
        successCount: 95,
        failures: [],
        remaining: [],
        recommendedVisibilitySeconds: 0,
      });
      const incrementSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'incrementMetric')
        .mockResolvedValue(undefined);

      const records = Array.from({ length: 100 }, (_, i) => makeResolvedRecord(i + 1));
      const message = { records } as MigrateCaseAppointmentsPageMessage;

      await handlePage(message, invocationContext);

      expect(MigrateCaseAppointmentsUseCase.writePage).toHaveBeenCalledWith(
        expect.anything(),
        records,
        expect.objectContaining({ safeThresholdMs: expect.any(Number) }),
      );
      expect(incrementSpy).toHaveBeenCalledWith(expect.anything(), 'processedCount', 95);
    });

    test('enqueues failures to FAILURES queue and increments failedCount', async () => {
      const { handlePage } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'writePage').mockResolvedValue({
        successCount: 98,
        failures: [
          { record: makeResolvedRecord(), reason: 'trustee-not-found' },
          { record: makeResolvedRecord(1002), reason: 'invalid-date' },
        ],
        remaining: [],
        recommendedVisibilitySeconds: 0,
      });
      const incrementSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'incrementMetric')
        .mockResolvedValue(undefined);

      const records = Array.from({ length: 100 }, (_, i) => makeResolvedRecord(i + 1));
      await handlePage({ records } as MigrateCaseAppointmentsPageMessage, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const failureOutput = outputs.find((v) => Array.isArray(v));
      expect(failureOutput).toBeDefined();
      expect((failureOutput as string[]).length).toBe(2);
      expect(incrementSpy).toHaveBeenCalledWith(expect.anything(), 'failedCount', 2);
    });
  });

  describe('handlePage — escape hatch', () => {
    const REMAINING_RECORD = makeResolvedRecord(9001);
    const CONNECTION_STRING =
      'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc123==;EndpointSuffix=core.windows.net';

    test('re-enqueues remaining records when writePage returns non-empty remaining', async () => {
      const { handlePage } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'writePage').mockResolvedValue({
        successCount: 10,
        failures: [],
        remaining: [REMAINING_RECORD],
        recommendedVisibilitySeconds: 60,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'incrementMetric').mockResolvedValue(undefined);

      const sendMessageSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(
        StorageQueueHumbleModule.StorageQueueHumbleObject,
        'fromConnectionString',
      ).mockReturnValue({
        sendMessage: sendMessageSpy,
      } as unknown as ReturnType<
        typeof StorageQueueHumbleModule.StorageQueueHumbleObject.fromConnectionString
      >);

      process.env.AzureWebJobsDataflowsStorage = CONNECTION_STRING;

      const records = [makeResolvedRecord(1)];
      await handlePage({ records } as MigrateCaseAppointmentsPageMessage, invocationContext);

      expect(sendMessageSpy).toHaveBeenCalledOnce();
      const [payload, visibilityTimeout] = sendMessageSpy.mock.calls[0];
      const parsed = JSON.parse(payload as string);
      expect(parsed.records).toHaveLength(1);
      expect(parsed.records[0].id).toBe(9001);
      // visibility = recommendedVisibilitySeconds (60) + jitter (0–29)
      expect(visibilityTimeout).toBeGreaterThanOrEqual(60);
      expect(visibilityTimeout).toBeLessThanOrEqual(89);

      delete process.env.AzureWebJobsDataflowsStorage;
    });

    test('does not construct queue client when remaining is empty', async () => {
      const { handlePage } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'writePage').mockResolvedValue({
        successCount: 10,
        failures: [],
        remaining: [],
        recommendedVisibilitySeconds: 0,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'incrementMetric').mockResolvedValue(undefined);
      const fromConnectionStringSpy = vi.spyOn(
        StorageQueueHumbleModule.StorageQueueHumbleObject,
        'fromConnectionString',
      );

      await handlePage(
        { records: [makeResolvedRecord(1)] } as MigrateCaseAppointmentsPageMessage,
        invocationContext,
      );

      expect(fromConnectionStringSpy).not.toHaveBeenCalled();
    });

    test('routes remaining to FAILURES when AzureWebJobsDataflowsStorage is not set', async () => {
      const { handlePage } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'writePage').mockResolvedValue({
        successCount: 5,
        failures: [],
        remaining: [REMAINING_RECORD],
        recommendedVisibilitySeconds: 60,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'incrementMetric').mockResolvedValue(undefined);

      delete process.env.AzureWebJobsDataflowsStorage;

      await handlePage(
        { records: [makeResolvedRecord(1)] } as MigrateCaseAppointmentsPageMessage,
        invocationContext,
      );

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const failureOutput = outputs.find((v) => Array.isArray(v));
      expect(failureOutput).toBeDefined();
      expect((failureOutput as string[]).length).toBe(1);
      const parsed = JSON.parse((failureOutput as string[])[0]);
      expect(parsed.reason).toBe('escape-hatch-no-connection-string');
    });

    test('routes remaining to FAILURES when sendMessage throws', async () => {
      const { handlePage } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'writePage').mockResolvedValue({
        successCount: 5,
        failures: [],
        remaining: [REMAINING_RECORD],
        recommendedVisibilitySeconds: 60,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'incrementMetric').mockResolvedValue(undefined);
      vi.spyOn(
        StorageQueueHumbleModule.StorageQueueHumbleObject,
        'fromConnectionString',
      ).mockReturnValue({
        sendMessage: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      } as unknown as ReturnType<
        typeof StorageQueueHumbleModule.StorageQueueHumbleObject.fromConnectionString
      >);

      process.env.AzureWebJobsDataflowsStorage = CONNECTION_STRING;

      await handlePage(
        { records: [makeResolvedRecord(1)] } as MigrateCaseAppointmentsPageMessage,
        invocationContext,
      );

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const failureOutput = outputs.find((v) => Array.isArray(v));
      expect(failureOutput).toBeDefined();
      expect((failureOutput as string[]).length).toBe(1);
      const parsed = JSON.parse((failureOutput as string[])[0]);
      expect(parsed.reason).toBe('escape-hatch-reenqueue-failed');

      delete process.env.AzureWebJobsDataflowsStorage;
    });
  });

  describe('handleStart — heal intent', () => {
    test('calls heal and does not start backfill', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      const healSpy = vi.spyOn(MigrateCaseAppointmentsUseCase, 'heal').mockResolvedValue();

      await handleStart({ heal: true } as MigrateCaseAppointmentsStartMessage, invocationContext);

      expect(healSpy).toHaveBeenCalledWith(expect.anything());

      // No PAGE messages should have been enqueued
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const pageMessages = outputs.filter((v) => Array.isArray(v));
      expect(pageMessages).toHaveLength(0);
    });
  });

  describe('isAcmsTimeoutError utility', () => {
    test('returns true when message contains Timeout', async () => {
      const { isAcmsTimeoutError } = await import('./migrate-case-appointments');
      expect(isAcmsTimeoutError(new Error('Timeout: query exceeded limit'))).toBe(true);
    });

    test('returns true when message contains RequestError', async () => {
      const { isAcmsTimeoutError } = await import('./migrate-case-appointments');
      expect(isAcmsTimeoutError(new Error('RequestError: connection refused'))).toBe(true);
    });

    test('returns false for non-timeout errors', async () => {
      const { isAcmsTimeoutError } = await import('./migrate-case-appointments');
      expect(isAcmsTimeoutError(new Error('Some other error'))).toBe(false);
    });

    test('returns false for non-Error values', async () => {
      const { isAcmsTimeoutError } = await import('./migrate-case-appointments');
      expect(isAcmsTimeoutError('not an error')).toBe(false);
    });
  });

  describe('handleStart — ACMS timeout handling', () => {
    test('re-enqueues on timeout with visibility delay and increments timeoutRetryCount', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      process.env.AzureWebJobsDataflowsStorage = 'UseDevelopmentStorage=true';

      const timeoutError = new Error('Timeout: request exceeded limit');
      (timeoutError as { originalError?: { code?: string } }).originalError = {
        code: 'ETIMEOUT',
      };

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockRejectedValue(timeoutError);
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'incrementMetric').mockResolvedValue();

      const mockQueueClient = {
        sendMessage: vi.fn().mockResolvedValue(undefined),
      };
      vi.spyOn(StorageQueueHumbleModule, 'StorageQueueHumbleObject', 'get').mockReturnValue({
        fromConnectionString: vi.fn().mockReturnValue(mockQueueClient),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await handleStart(
        { lastId: 100, timeoutRetryCount: 1 } as MigrateCaseAppointmentsStartMessage,
        invocationContext,
      );

      // Verify sendMessage was called with visibility delay
      expect(mockQueueClient.sendMessage).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendCall = (mockQueueClient.sendMessage as any).mock.calls[0] as Array<unknown>;
      expect(sendCall[1]).toBeGreaterThan(0); // visibility delay

      // Verify message includes incremented timeoutRetryCount
      const messageStr = sendCall[0] as string;
      const message = JSON.parse(messageStr);
      expect(message.timeoutRetryCount).toBe(2);
    });

    test('routes to DLQ when timeout retries exhausted', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      const ACMS_TIMEOUT_RETRY_LIMIT = 5;

      const timeoutError = new Error('Timeout: request exceeded limit');
      (timeoutError as { originalError?: { code?: string } }).originalError = {
        code: 'ETIMEOUT',
      };

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockRejectedValue(timeoutError);
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });
      const updateStateSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState')
        .mockResolvedValue({ data: MOCK_STATE });

      await handleStart(
        {
          lastId: 100,
          timeoutRetryCount: ACMS_TIMEOUT_RETRY_LIMIT,
        } as MigrateCaseAppointmentsStartMessage,
        invocationContext,
      );

      // State marked FAILED
      expect(updateStateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'FAILED' }),
        expect.anything(),
      );

      // DLQ receives error
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const dlqOutput = outputs.find((v) => {
        if (typeof v !== 'object' || v === null) return false;
        const msg = v as Record<string, unknown>;
        return 'module' in msg || 'error' in msg;
      });
      expect(dlqOutput).toBeDefined();
    });

    test('fails fast on non-timeout errors without retry', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      const nonTimeoutError = new Error('Database connection failed');

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockRejectedValue(nonTimeoutError);
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });
      const updateStateSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState')
        .mockResolvedValue({ data: MOCK_STATE });

      await handleStart(
        { lastId: 100, timeoutRetryCount: 1 } as MigrateCaseAppointmentsStartMessage,
        invocationContext,
      );

      // State marked FAILED immediately
      expect(updateStateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'FAILED' }),
        expect.anything(),
      );

      // DLQ receives error
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const dlqOutput = outputs.find((v) => {
        if (typeof v !== 'object' || v === null) return false;
        const msg = v as Record<string, unknown>;
        return 'module' in msg || 'error' in msg;
      });
      expect(dlqOutput).toBeDefined();
    });

    test('does not carry timeoutRetryCount to next cursor message on success', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      const records = [makeResolvedRecord(1001), makeResolvedRecord(1002)];

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockResolvedValue({
        records,
        nextLastId: 1003,
        isEmpty: false,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });

      // Call with timeoutRetryCount set to prove it gets reset on success
      await handleStart(
        { lastId: 1000, timeoutRetryCount: 3 } as MigrateCaseAppointmentsStartMessage,
        invocationContext,
      );

      // Extract START queue output
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const startMessages = outputs.find(
        (v) => typeof v === 'object' && v !== null && (v as { lastId?: unknown }).lastId === 1003,
      );

      expect(startMessages).toBeDefined();

      // Verify message does NOT have timeoutRetryCount field
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgObj = startMessages as any;
      expect(msgObj.timeoutRetryCount).toBeUndefined();
    });
  });
});
