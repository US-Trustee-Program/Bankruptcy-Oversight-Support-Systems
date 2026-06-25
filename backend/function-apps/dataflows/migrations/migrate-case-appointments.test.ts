import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as StorageQueue from '@azure/storage-queue';
import MigrateCaseAppointmentsUseCase from '../../../lib/use-cases/dataflows/migrate-case-appointments';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CamsError } from '../../../lib/common-errors/cams-error';
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
  trusteeId: 'trustee-001',
});

const MOCK_STATE = {
  documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE' as const,
  lastId: null,
  processedCount: 0,

  readingCompleted: false,
  startedAt: '2025-01-01T00:00:00.000Z',
  lastUpdatedAt: '2025-01-02T00:00:00.000Z',
  status: 'IN_PROGRESS' as const,
};

describe('migrate-case-appointments', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.DATABASE_MOCK = 'true';

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockReturnValue(undefined);
  });

  describe('handleStart — resume', () => {
    test('enqueues continuation from existing lastId without deleting', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: { ...MOCK_STATE, lastId: 5000, processedCount: 50000, status: 'IN_PROGRESS' },
      });
      const deleteSpy = vi.spyOn(MigrateCaseAppointmentsUseCase, 'deleteAll');

      await handleStart({ resume: true }, invocationContext);

      expect(deleteSpy).not.toHaveBeenCalled();
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
    test('always deletes all and resets state before enqueuing first continuation', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'deleteAll').mockResolvedValue({
        data: { deletedCount: 42 },
      });
      const updateSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState')
        .mockResolvedValue({ data: MOCK_STATE });

      await handleStart({} as MigrateCaseAppointmentsStartMessage, invocationContext);

      expect(MigrateCaseAppointmentsUseCase.deleteAll).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ lastId: null, processedCount: 0, status: 'IN_PROGRESS' }),
      );
    });

    test('enqueues continuation { lastId: null } to START queue after reset', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'deleteAll').mockResolvedValue({
        data: { deletedCount: 0 },
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });

      await handleStart({} as MigrateCaseAppointmentsStartMessage, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).entries()];
      const startOutput = outputs.find(([, v]) => {
        const val = v as { lastId?: unknown };
        return typeof val === 'object' && val !== null && 'lastId' in val && val.lastId === null;
      });
      expect(startOutput).toBeDefined();
    });

    test('sends to DLQ and marks FAILED when deleteAll errors', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();
      const deleteError = new CamsError('TEST', { message: 'Delete failed' });

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'deleteAll').mockResolvedValue({
        error: deleteError,
      });
      const updateSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState')
        .mockResolvedValue({ data: MOCK_STATE });

      await handleStart({} as MigrateCaseAppointmentsStartMessage, invocationContext);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'FAILED' }),
      );
      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      expect(outputs.length).toBeGreaterThan(0);
    });
  });

  describe('handleStart — continuation (lastId present)', () => {
    test('reads from ACMS, chunks, enqueues to PAGE queue and self-enqueues next cursor', async () => {
      const { handleStart } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      const records = Array.from({ length: 150 }, (_, i) => makeResolvedRecord(i + 1));
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readPage').mockResolvedValue({
        records,
        nextLastId: 150,
        isEmpty: false,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        data: MOCK_STATE,
      });

      await handleStart({ lastId: 0 } as MigrateCaseAppointmentsStartMessage, invocationContext);

      // 150 records / 50 per batch = 3 PAGE messages
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

      await handleStart(
        { lastId: 100, attempt: 4 } as MigrateCaseAppointmentsStartMessage,
        invocationContext,
      );

      const completeTraceSpy = DataflowTelemetry.completeDataflowTrace as ReturnType<typeof vi.fn>;
      expect(completeTraceSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.any(String),
        'handleStart',
        expect.anything(),
        expect.objectContaining({ success: false }),
      );
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
      );
      expect(incrementSpy).toHaveBeenCalledWith(expect.anything(), 'processedCount', 95);
    });

    test('enqueues failures to FAILURES queue', async () => {
      const { handlePage } = await import('./migrate-case-appointments');
      const invocationContext = makeInvocationContext();

      vi.spyOn(MigrateCaseAppointmentsUseCase, 'writePage').mockResolvedValue({
        successCount: 98,
        failures: [
          { record: makeResolvedRecord(), reason: 'trustee-not-found' },
          { record: makeResolvedRecord(1002), reason: 'invalid-date' },
        ],
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'incrementMetric').mockResolvedValue(undefined);

      const records = Array.from({ length: 100 }, (_, i) => makeResolvedRecord(i + 1));
      await handlePage({ records } as MigrateCaseAppointmentsPageMessage, invocationContext);

      const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
      const failureOutput = outputs.find((v) => Array.isArray(v));
      expect(failureOutput).toBeDefined();
      expect((failureOutput as string[]).length).toBe(2);
    });
  });
});
