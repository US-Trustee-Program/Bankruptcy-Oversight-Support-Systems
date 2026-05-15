import { vi, describe, test, expect, beforeEach } from 'vitest';
import { app, InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import MigrateCaseAppointmentsUseCase from '../../../lib/use-cases/dataflows/migrate-case-appointments';
import MigrateCaseAppointmentsMigration, {
  handleStart,
  handlePage,
  handleError,
  handleRetry,
} from './migrate-case-appointments';
import { CamsError } from '../../../lib/common-errors/cams-error';

function makeMockInvocationContext(): InvocationContext {
  const extraOutputsMap = new Map();
  return {
    invocationId: 'test-invocation-id',
    functionName: 'migrate-case-appointments',
    extraOutputs: {
      set: vi.fn((key, value) => extraOutputsMap.set(key, value)),
      get: vi.fn((key) => extraOutputsMap.get(key)),
      _map: extraOutputsMap,
    },
    log: vi.fn(),
  } as unknown as InvocationContext;
}

function getExtraOutputsMap(ctx: InvocationContext): Map<unknown, unknown> {
  return (ctx.extraOutputs as unknown as { _map: Map<unknown, unknown> })._map;
}

describe('migrate-case-appointments', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await createMockApplicationContext();
  });

  describe('handleStart', () => {
    test('queues first page cursor when no prior state exists', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: null,
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        data: {} as never,
      });

      const ctx = makeMockInvocationContext();
      await handleStart({}, ctx);

      const map = getExtraOutputsMap(ctx);
      const pageMessages = [...map.values()].filter(
        (v) => v !== null && typeof v === 'object' && 'lastId' in (v as object),
      );
      expect(pageMessages).toHaveLength(1);
      expect(pageMessages[0]).toMatchObject({ lastId: null });
    });

    test('resumes from prior cursor when state exists', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: {
          id: 'state-1',
          documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
          lastId: 500,
          processedCount: 50,
          status: 'IN_PROGRESS',
          startedAt: '2025-01-01T00:00:00Z',
          lastUpdatedAt: '2025-01-02T00:00:00Z',
        },
      });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        data: {} as never,
      });

      const ctx = makeMockInvocationContext();
      await handleStart({}, ctx);

      const map = getExtraOutputsMap(ctx);
      const pageMessages = [...map.values()].filter(
        (v) => v !== null && typeof v === 'object' && 'lastId' in (v as object),
      );
      expect(pageMessages).toHaveLength(1);
      expect(pageMessages[0]).toMatchObject({ lastId: 500 });
    });

    test('skips when migration already completed', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: {
          id: 'state-1',
          documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
          lastId: 1000,
          processedCount: 1000,
          status: 'COMPLETED',
          startedAt: '2025-01-01T00:00:00Z',
          lastUpdatedAt: '2025-01-03T00:00:00Z',
        },
      });

      const ctx = makeMockInvocationContext();
      await handleStart({}, ctx);

      expect(ctx.extraOutputs.set).not.toHaveBeenCalled();
    });

    test('sends to DLQ when readMigrationState returns error', async () => {
      const err = new CamsError('TEST', { message: 'state read failed' });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        error: err,
      });

      const ctx = makeMockInvocationContext();
      await handleStart({}, ctx);

      const map = getExtraOutputsMap(ctx);
      const dlqValues = [...map.values()].filter(
        (v) =>
          v !== null && typeof v === 'object' && (v as { type?: string }).type === 'QUEUE_ERROR',
      );
      expect(dlqValues).toHaveLength(1);
      expect((dlqValues[0] as { error: CamsError }).error).toBe(err);
    });

    test('sends to DLQ when updateMigrationState returns error', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'readMigrationState').mockResolvedValue({
        data: null,
      });
      const err = new CamsError('TEST', { message: 'state update failed' });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'updateMigrationState').mockResolvedValue({
        error: err,
      });

      const ctx = makeMockInvocationContext();
      await handleStart({}, ctx);

      const map = getExtraOutputsMap(ctx);
      const dlqValues = [...map.values()].filter(
        (v) =>
          v !== null && typeof v === 'object' && (v as { type?: string }).type === 'QUEUE_ERROR',
      );
      expect(dlqValues).toHaveLength(1);
      expect((dlqValues[0] as { error: CamsError }).error).toBe(err);
    });
  });

  describe('handlePage', () => {
    test('queues next page cursor on continue status', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'processPage').mockResolvedValue({
        status: 'continue',
        processedCount: 100,
        successCount: 98,
        failedCount: 2,
        nextLastId: 1100,
      });

      const ctx = makeMockInvocationContext();
      await handlePage({ lastId: 1000 }, ctx);

      const map = getExtraOutputsMap(ctx);
      const pageMessages = [...map.values()].filter(
        (v) => v !== null && typeof v === 'object' && 'lastId' in (v as object),
      );
      expect(pageMessages).toHaveLength(1);
      expect(pageMessages[0]).toMatchObject({ lastId: 1100 });
    });

    test('does not queue next page on done status', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'processPage').mockResolvedValue({
        status: 'done',
        processedCount: 50,
        successCount: 50,
        failedCount: 0,
        nextLastId: null,
      });

      const ctx = makeMockInvocationContext();
      await handlePage({ lastId: null }, ctx);

      expect(ctx.extraOutputs.set).not.toHaveBeenCalled();
    });

    test('does not queue next page on empty status', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'processPage').mockResolvedValue({
        status: 'empty',
      });

      const ctx = makeMockInvocationContext();
      await handlePage({ lastId: null }, ctx);

      expect(ctx.extraOutputs.set).not.toHaveBeenCalled();
    });

    test('sends to DLQ on error status', async () => {
      const err = new CamsError('TEST', { message: 'processPage failed' });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'processPage').mockResolvedValue({
        status: 'error',
        error: err,
      });

      const ctx = makeMockInvocationContext();
      await handlePage({ lastId: null }, ctx);

      const map = getExtraOutputsMap(ctx);
      const dlqValues = [...map.values()].filter(
        (v) =>
          v !== null && typeof v === 'object' && (v as { type?: string }).type === 'QUEUE_ERROR',
      );
      expect(dlqValues).toHaveLength(1);
      expect((dlqValues[0] as { error: CamsError }).error).toBe(err);
    });
  });

  describe('handleError', () => {
    test('forwards event to retry queue', async () => {
      const event = {
        id: 42,
        caseId: '081-24-12345',
        acmsProfessionalId: 'NY-00063',
        assignDate: 20200101,
        apptDate: 20200110,
        unassignDate: null,
        lastErrorMessage: 'Something went wrong',
      };

      const ctx = makeMockInvocationContext();
      await handleError(event, ctx);

      const map = getExtraOutputsMap(ctx);
      expect(map.size).toBe(1);
      const retryValue = [...map.values()][0];
      expect(Array.isArray(retryValue)).toBe(true);
      expect((retryValue as unknown[])[0]).toMatchObject({ id: 42, caseId: '081-24-12345' });
    });

    test('logs error message including record id', async () => {
      const event = {
        id: 99,
        caseId: '081-24-00099',
        acmsProfessionalId: 'NY-00099',
        assignDate: 20210101,
        apptDate: 20210110,
        unassignDate: null,
        lastErrorMessage: 'DB timeout',
      };

      const ctx = makeMockInvocationContext();
      await handleError(event, ctx);

      const logCalls = (ctx.log as ReturnType<typeof vi.fn>).mock.calls;
      const loggedMessages = logCalls.map((args) => String(args[0]));
      expect(loggedMessages.some((msg) => msg.includes('99'))).toBe(true);
    });
  });

  describe('handleRetry', () => {
    const baseRecord = {
      id: 100,
      caseId: '081-24-12345',
      acmsProfessionalId: 'NY-00063',
      assignDate: 20200101,
      apptDate: 20200110,
      unassignDate: null,
    };

    test('retries successfully — no DLQ output', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'processSingleRecord').mockResolvedValue({
        status: 'success',
      });

      const ctx = makeMockInvocationContext();
      await handleRetry({ ...baseRecord, retryCount: 0 }, ctx);

      const map = getExtraOutputsMap(ctx);
      expect(map.size).toBe(0);
    });

    test('sends to DLQ when processSingleRecord returns error on retry', async () => {
      const err = new CamsError('TEST', { message: 'retry failed' });
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'processSingleRecord').mockResolvedValue({
        status: 'error',
        error: err,
      });

      const ctx = makeMockInvocationContext();
      await handleRetry({ ...baseRecord, retryCount: 1 }, ctx);

      const map = getExtraOutputsMap(ctx);
      expect(map.size).toBe(1);
      const dlqValue = [...map.values()][0];
      expect(Array.isArray(dlqValue)).toBe(true);
      expect((dlqValue as unknown[])[0]).toMatchObject({ lastErrorMessage: 'retry failed' });
    });

    test('sends to DLQ when processSingleRecord throws on retry', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'processSingleRecord').mockRejectedValue(
        new Error('unexpected crash'),
      );

      const ctx = makeMockInvocationContext();
      await handleRetry({ ...baseRecord, retryCount: 1 }, ctx);

      const map = getExtraOutputsMap(ctx);
      expect(map.size).toBe(1);
      const dlqValue = [...map.values()][0];
      expect((dlqValue as unknown[])[0]).toMatchObject({ lastErrorMessage: 'unexpected crash' });
    });

    test('sends to hard-stop queue when retry limit exceeded', async () => {
      const processSpy = vi.spyOn(MigrateCaseAppointmentsUseCase, 'processSingleRecord');

      const ctx = makeMockInvocationContext();
      await handleRetry({ ...baseRecord, retryCount: 3 }, ctx);

      const map = getExtraOutputsMap(ctx);
      expect(map.size).toBe(1);
      const hardStopValue = [...map.values()][0];
      expect(Array.isArray(hardStopValue)).toBe(true);
      expect((hardStopValue as unknown[])[0]).toMatchObject({ id: 100 });
      expect(processSpy).not.toHaveBeenCalled();
    });

    test('at retry limit boundary (retryCount: 2) — still retries, no hard-stop', async () => {
      const processSpy = vi
        .spyOn(MigrateCaseAppointmentsUseCase, 'processSingleRecord')
        .mockResolvedValue({ status: 'skipped' });

      const ctx = makeMockInvocationContext();
      await handleRetry({ ...baseRecord, retryCount: 2 }, ctx);

      expect(processSpy).toHaveBeenCalled();
      const map = getExtraOutputsMap(ctx);
      expect(map.size).toBe(0);
    });

    test('on successful retry — no DLQ or hard-stop output', async () => {
      vi.spyOn(MigrateCaseAppointmentsUseCase, 'processSingleRecord').mockResolvedValue({
        status: 'success',
      });

      const ctx = makeMockInvocationContext();
      await handleRetry({ ...baseRecord, retryCount: 1, lastErrorMessage: 'prev error' }, ctx);

      const map = getExtraOutputsMap(ctx);
      expect(map.size).toBe(0);
    });
  });

  describe('module registration', () => {
    test('registers four storage queue handlers with distinct queue names', () => {
      const storageQueueSpy = vi.spyOn(app, 'storageQueue').mockReturnValue(undefined as never);

      MigrateCaseAppointmentsMigration.setup();

      expect(storageQueueSpy).toHaveBeenCalledTimes(4);
      const registeredQueueNames = storageQueueSpy.mock.calls.map((call) => call[1].queueName);
      const uniqueQueueNames = new Set(registeredQueueNames);
      expect(uniqueQueueNames.size).toBe(4);
    });

    test('each handler registration names handleStart, handlePage, handleError, handleRetry', () => {
      const storageQueueSpy = vi.spyOn(app, 'storageQueue').mockReturnValue(undefined as never);

      MigrateCaseAppointmentsMigration.setup();

      const functionNames = storageQueueSpy.mock.calls.map((call) => call[0]);
      expect(functionNames.some((n) => n.includes('handleStart'))).toBe(true);
      expect(functionNames.some((n) => n.includes('handlePage'))).toBe(true);
      expect(functionNames.some((n) => n.includes('handleError'))).toBe(true);
      expect(functionNames.some((n) => n.includes('handleRetry'))).toBe(true);
    });
  });
});
