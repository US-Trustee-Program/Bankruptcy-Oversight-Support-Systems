import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import * as MigrateTrusteesUseCase from '../../../lib/use-cases/dataflows/migrate-trustees';
import * as MigrationStateService from '../../../lib/use-cases/dataflows/trustee-migration-state.service';
import { TooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { handleStart, handlePage } from './migrate-trustees';
import { TrusteeMigrationState } from '../../../lib/use-cases/dataflows/trustee-migration-state.service';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'migrate-trustees',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeMigrationState = (
  overrides: Partial<TrusteeMigrationState> = {},
): TrusteeMigrationState =>
  ({
    status: 'IN_PROGRESS',
    processedCount: 0,
    appointmentsProcessedCount: 0,
    errors: 0,
    lastTrusteeId: null,
    lastUpdatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }) as TrusteeMigrationState;

describe('migrate-trustees', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('handleStart', () => {
    test('should queue first page cursor on success', async () => {
      const invocationContext = makeInvocationContext();
      const mockContext = await createMockApplicationContext();

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: makeMigrationState({ status: 'IN_PROGRESS' }),
        error: null,
      });

      const start = { deleteAll: false } as Parameters<typeof handleStart>[0];
      await handleStart(start, invocationContext);

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const pageOutput = outputs.find(([key]) => key.queueName?.includes('page'));
      expect(pageOutput).toBeDefined();
      expect(pageOutput?.[1]).toMatchObject({ lastId: null });
    });

    test('should write to DLQ and return on stateResult error', async () => {
      const invocationContext = makeInvocationContext();
      const mockContext = await createMockApplicationContext();
      const stateError = new CamsError('MIGRATE-TRUSTEES', { message: 'State read failed' });

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: null,
        error: stateError,
      });

      const start = { deleteAll: false } as Parameters<typeof handleStart>[0];
      await handleStart(start, invocationContext);

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeDefined();
      expect(dlqOutput?.[1]).toMatchObject({ type: 'QUEUE_ERROR' });
    });

    test('should rethrow 429 error without writing to DLQ', async () => {
      const invocationContext = makeInvocationContext();
      const mockContext = await createMockApplicationContext();
      const rateLimitError = new TooManyRequestsError('MIGRATE-TRUSTEES');

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockRejectedValue(
        rateLimitError,
      );

      const start = { deleteAll: false } as Parameters<typeof handleStart>[0];
      await expect(handleStart(start, invocationContext)).rejects.toThrow(TooManyRequestsError);

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeUndefined();
    });

    test('should write to DLQ and rethrow on non-429 error', async () => {
      const invocationContext = makeInvocationContext();
      const mockContext = await createMockApplicationContext();
      const error = new CamsError('MIGRATE-TRUSTEES', { message: 'Cosmos write failed' });

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockRejectedValue(error);

      const start = { deleteAll: false } as Parameters<typeof handleStart>[0];
      await expect(handleStart(start, invocationContext)).rejects.toThrow('Cosmos write failed');

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeDefined();
      expect(dlqOutput?.[1]).toMatchObject({ type: 'QUEUE_ERROR' });
    });
  });

  describe('handlePage', () => {
    test('should queue next cursor when more pages remain', async () => {
      const invocationContext = makeInvocationContext();
      const mockContext = await createMockApplicationContext();

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: makeMigrationState(),
        error: null,
      });
      vi.spyOn(MigrateTrusteesUseCase, 'getPageOfTrustees').mockResolvedValue({
        data: { trustees: [{ ID: 42 } as never], hasMore: true, totalProcessed: 0 },
        error: null,
      });
      vi.spyOn(MigrateTrusteesUseCase, 'processPageOfTrustees').mockResolvedValue({
        data: { processed: 1, appointments: 0, errors: 0, failedAppointments: [] },
        error: null,
      });
      vi.spyOn(MigrationStateService, 'updateMigrationState').mockResolvedValue({
        data: undefined,
        error: null,
      });

      const cursor = { lastId: null };
      await handlePage(cursor, invocationContext);

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const pageOutput = outputs.find(([key]) => key.queueName?.includes('page'));
      expect(pageOutput).toBeDefined();
      expect(pageOutput?.[1]).toMatchObject({ lastId: '42' });
    });

    test('should write to DLQ and return on stateResult error', async () => {
      const invocationContext = makeInvocationContext();
      const mockContext = await createMockApplicationContext();
      const stateError = new CamsError('MIGRATE-TRUSTEES', { message: 'State read failed' });

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: null,
        error: stateError,
      });

      const cursor = { lastId: null };
      await handlePage(cursor, invocationContext);

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeDefined();
      expect(dlqOutput?.[1]).toMatchObject({ type: 'QUEUE_ERROR' });
    });

    test('should not queue next cursor when no more pages remain', async () => {
      const invocationContext = makeInvocationContext();
      const mockContext = await createMockApplicationContext();

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockResolvedValue({
        data: makeMigrationState(),
        error: null,
      });
      vi.spyOn(MigrateTrusteesUseCase, 'getPageOfTrustees').mockResolvedValue({
        data: { trustees: [{ ID: 42 } as never], hasMore: false, totalProcessed: 1 },
        error: null,
      });
      vi.spyOn(MigrateTrusteesUseCase, 'processPageOfTrustees').mockResolvedValue({
        data: { processed: 1, appointments: 0, errors: 0, failedAppointments: [] },
        error: null,
      });
      vi.spyOn(MigrationStateService, 'updateMigrationState').mockResolvedValue({
        data: undefined,
        error: null,
      });

      const cursor = { lastId: null };
      await handlePage(cursor, invocationContext);

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const pageOutput = outputs.find(([key]) => key.queueName?.includes('page'));
      expect(pageOutput).toBeUndefined();
    });

    test('should rethrow 429 error without writing to DLQ', async () => {
      const invocationContext = makeInvocationContext();
      const mockContext = await createMockApplicationContext();
      const rateLimitError = new TooManyRequestsError('MIGRATE-TRUSTEES');

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockRejectedValue(
        rateLimitError,
      );

      const cursor = { lastId: null };
      await expect(handlePage(cursor, invocationContext)).rejects.toThrow(TooManyRequestsError);

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeUndefined();
    });

    test('should write to DLQ and rethrow on non-429 error', async () => {
      const invocationContext = makeInvocationContext();
      const mockContext = await createMockApplicationContext();
      const error = new CamsError('MIGRATE-TRUSTEES', { message: 'Database timeout' });

      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(MigrationStateService, 'getOrCreateMigrationState').mockRejectedValue(error);

      const cursor = { lastId: null };
      await expect(handlePage(cursor, invocationContext)).rejects.toThrow('Database timeout');

      const outputs = Array.from(
        (
          invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>
        ).entries(),
      );
      const dlqOutput = outputs.find(([key]) => key.queueName?.includes('dlq'));
      expect(dlqOutput).toBeDefined();
      expect(dlqOutput?.[1]).toMatchObject({ type: 'QUEUE_ERROR' });
    });
  });
});
