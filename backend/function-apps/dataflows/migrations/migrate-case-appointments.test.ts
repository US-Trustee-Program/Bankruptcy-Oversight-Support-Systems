import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as StorageQueue from '@azure/storage-queue';
import MigrateCaseAppointmentsUseCase from '../../../lib/use-cases/dataflows/migrate-case-appointments';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { CamsError } from '../../../lib/common-errors/cams-error';
import type { MigrateCaseAppointmentsStartMessage } from './migrate-case-appointments';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-invocation-id',
    functionName: 'migrate-case-appointments-handleStart',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('migrate-case-appointments handleStart flags', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.DATABASE_MOCK = 'true';

    const mockContext = await createMockApplicationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockReturnValue(undefined);
  });

  test('deleteAll: true — calls use case deleteAll then runs migration from null cursor', async () => {
    const { handleStart } = await import('./migrate-case-appointments');
    const invocationContext = makeInvocationContext();

    vi.spyOn(MigrateCaseAppointmentsUseCase, 'deleteAll').mockResolvedValue({
      data: { deletedCount: 42 },
    });
    vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
      data: {
        documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
        lastId: 9999,
        processedCount: 500,
        startedAt: '2025-01-01T00:00:00.000Z',
        lastUpdatedAt: '2025-01-02T00:00:00.000Z',
        status: 'IN_PROGRESS',
      },
    });
    vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
      data: {
        documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
        lastId: null,
        processedCount: 0,
        startedAt: '2025-01-01T00:00:00.000Z',
        lastUpdatedAt: '2025-01-02T00:00:00.000Z',
        status: 'IN_PROGRESS',
      },
    });

    await handleStart(
      { deleteAll: true } as MigrateCaseAppointmentsStartMessage,
      invocationContext,
    );

    expect(MigrateCaseAppointmentsUseCase.deleteAll).toHaveBeenCalledWith(expect.anything());
    // updateMigrationState called with lastId: null and processedCount: 0 (cursor reset)
    expect(MigrateCaseAppointmentsUseCase.updateMigrationState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lastId: null, processedCount: 0 }),
      expect.anything(),
    );
  });

  test('deleteAll: true — routes to DLQ and returns when deleteAll fails', async () => {
    const { handleStart } = await import('./migrate-case-appointments');
    const invocationContext = makeInvocationContext();
    const deleteError = new CamsError('MIGRATE-CASE-APPOINTMENTS', {
      message: 'Delete failed',
    });

    vi.spyOn(MigrateCaseAppointmentsUseCase, 'deleteAll').mockResolvedValue({
      error: deleteError,
    });
    const readStateSpy = vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState');
    const completeTraceSpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart(
      { deleteAll: true } as MigrateCaseAppointmentsStartMessage,
      invocationContext,
    );

    expect(readStateSpy).not.toHaveBeenCalled();

    // DLQ should have been set with a queue error
    const dlqEntries = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
    expect(dlqEntries.length).toBeGreaterThan(0);

    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(String),
      'handleStart',
      expect.anything(),
      expect.objectContaining({ success: false }),
    );
  });

  test('flushQueues: true — dumps queues to blob storage and returns without enqueuing a page', async () => {
    const { handleStart } = await import('./migrate-case-appointments');
    const invocationContext = makeInvocationContext();

    const mockReceiveMessages = vi.fn().mockResolvedValue({ receivedMessageItems: [] });
    const mockGetQueueClient = vi.fn().mockReturnValue({ receiveMessages: mockReceiveMessages });
    const mockWriteObject = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(StorageQueue.QueueServiceClient, 'fromConnectionString').mockReturnValue({
      getQueueClient: mockGetQueueClient,
    } as unknown as StorageQueue.QueueServiceClient);
    vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState');

    const mockContext = await createMockApplicationContext();
    // Inject a mock objectStorageGateway onto the factory-produced context
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue({
      ...mockContext,
      config: mockContext.config,
    });
    // Override factory.getObjectStorageGateway for this invocation
    const factory = (await import('../../../lib/factory')).default;
    vi.spyOn(factory, 'getObjectStorageGateway').mockReturnValue({
      writeObject: mockWriteObject,
      readObject: vi.fn(),
    });

    const completeTraceSpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleStart(
      { flushQueues: true } as MigrateCaseAppointmentsStartMessage,
      invocationContext,
    );

    // Should NOT read migration state or enqueue a page
    expect(MigrateCaseAppointmentsUseCase.readMigrationState).not.toHaveBeenCalled();
    const outputs = [...(invocationContext.extraOutputs as Map<unknown, unknown>).values()];
    expect(outputs.length).toBe(0);

    // Should complete trace with mode: flushQueues
    expect(completeTraceSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(String),
      'handleStart',
      expect.anything(),
      expect.objectContaining({
        success: true,
        details: expect.objectContaining({ mode: 'flushQueues' }),
      }),
    );
  });

  test('reset: true — bypasses COMPLETED guard and starts fresh from null cursor', async () => {
    const { handleStart } = await import('./migrate-case-appointments');
    const invocationContext = makeInvocationContext();

    vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
      data: {
        documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
        lastId: 5000,
        processedCount: 1000,
        startedAt: '2025-01-01T00:00:00.000Z',
        lastUpdatedAt: '2025-01-02T00:00:00.000Z',
        status: 'COMPLETED',
      },
    });
    vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
      data: {
        documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
        lastId: null,
        processedCount: 0,
        startedAt: '2025-01-01T00:00:00.000Z',
        lastUpdatedAt: '2025-01-02T00:00:00.000Z',
        status: 'IN_PROGRESS',
      },
    });

    await handleStart({ reset: true } as MigrateCaseAppointmentsStartMessage, invocationContext);

    // Should NOT skip even though state is COMPLETED
    expect(MigrateCaseAppointmentsUseCase.updateMigrationState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lastId: null, processedCount: 0 }),
      expect.anything(),
    );
  });
});
