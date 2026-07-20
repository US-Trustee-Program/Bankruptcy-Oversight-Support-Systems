import { describe, expect, test, beforeEach, vi, Mocked } from 'vitest';
import {
  getOrCreateMigrationState,
  readMigrationState,
  updateMigrationState,
  completeMigration,
  failMigration,
  resetMigrationState,
  initHealState,
  recordHealPageResult,
  TrusteeMigrationState,
} from './trustee-migration-state.service';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { RuntimeStateRepository } from '../gateways.types';

describe('trustee-migration-state.service', () => {
  let context: ApplicationContext;
  let mockRepository: Mocked<RuntimeStateRepository<TrusteeMigrationState>>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockRepository = {
      read: vi.fn(),
      upsert: vi.fn(),
      atomicDecrement: vi.fn(),
      atomicIncrement: vi.fn(),
    };

    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(mockRepository);
  });

  describe('getOrCreateMigrationState', () => {
    test('should return existing state when found', async () => {
      const existingState: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 50,
        appointmentsProcessedCount: 75,
        ambiguousCount: 0,
        errors: 2,
        startedAt: '2024-01-01T00:00:00Z',
        lastUpdatedAt: '2024-01-02T00:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRepository.read.mockResolvedValue(existingState);

      const result = await getOrCreateMigrationState(context);

      expect(result.data).toEqual(existingState);
      expect(result.error).toBeUndefined();
      expect(mockRepository.read).toHaveBeenCalledWith('TRUSTEE_MIGRATION_STATE');
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    test('should create new state when not found (error thrown)', async () => {
      mockRepository.read.mockRejectedValue(new Error('Not found'));
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await getOrCreateMigrationState(context);

      expect(result.data).toBeDefined();
      expect(result.data?.documentType).toBe('TRUSTEE_MIGRATION_STATE');
      expect(result.data?.lastTrusteeId).toBeNull();
      expect(result.data?.processedCount).toBe(0);
      expect(result.data?.appointmentsProcessedCount).toBe(0);
      expect(result.data?.ambiguousCount).toBe(0);
      expect(result.data?.errors).toBe(0);
      expect(result.data?.status).toBe('IN_PROGRESS');
      expect(result.data?.divisionMappingVersion).toBe('1.0.0');
      expect(result.error).toBeUndefined();
      expect(mockRepository.upsert).toHaveBeenCalled();
    });

    test('should create new state when read returns null', async () => {
      mockRepository.read.mockResolvedValue(null);
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await getOrCreateMigrationState(context);

      expect(result.data).toBeDefined();
      expect(result.data?.documentType).toBe('TRUSTEE_MIGRATION_STATE');
      expect(result.data?.lastTrusteeId).toBeNull();
      expect(result.data?.processedCount).toBe(0);
      expect(result.data?.appointmentsProcessedCount).toBe(0);
      expect(result.data?.ambiguousCount).toBe(0);
      expect(result.data?.errors).toBe(0);
      expect(result.data?.status).toBe('IN_PROGRESS');
      expect(result.data?.divisionMappingVersion).toBe('1.0.0');
      expect(result.error).toBeUndefined();
      expect(mockRepository.upsert).toHaveBeenCalled();
    });

    test('should handle upsert errors when creating new state', async () => {
      mockRepository.read.mockRejectedValue(new Error('Not found'));
      mockRepository.upsert.mockRejectedValue(new Error('Database error'));

      const result = await getOrCreateMigrationState(context);

      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to get or create migration state');
    });

    test('should create new state when reset is true, even if existing state exists', async () => {
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await getOrCreateMigrationState(context, true);

      // Should create new state instead of returning existing
      expect(result.data).toBeDefined();
      expect(result.data?.lastTrusteeId).toBeNull();
      expect(result.data?.processedCount).toBe(0);
      expect(result.data?.appointmentsProcessedCount).toBe(0);
      expect(result.data?.errors).toBe(0);
      expect(result.data?.status).toBe('IN_PROGRESS');
      expect(result.error).toBeUndefined();

      // Should NOT attempt to read existing state when reset is true
      expect(mockRepository.read).not.toHaveBeenCalled();

      // Should upsert the new state
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'TRUSTEE_MIGRATION_STATE',
          lastTrusteeId: null,
          processedCount: 0,
          appointmentsProcessedCount: 0,
          errors: 0,
          status: 'IN_PROGRESS',
        }),
      );
    });
  });

  describe('readMigrationState', () => {
    test('returns the existing state without creating one', async () => {
      const existingState = { status: 'COMPLETED' } as TrusteeMigrationState;
      mockRepository.read.mockResolvedValue(existingState);

      const result = await readMigrationState(context);

      expect(result.data).toBe(existingState);
      expect(mockRepository.read).toHaveBeenCalledWith('TRUSTEE_MIGRATION_STATE');
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    test('returns null when no state document exists', async () => {
      mockRepository.read.mockResolvedValue(null as unknown as TrusteeMigrationState);

      const result = await readMigrationState(context);

      expect(result.data).toBeNull();
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    test('treats a read that throws (document not found) as null, not an error', async () => {
      mockRepository.read.mockRejectedValue(new Error('QueueNotFound'));

      const result = await readMigrationState(context);

      expect(result.data).toBeNull();
      expect(result.error).toBeUndefined();
    });
  });

  describe('updateMigrationState', () => {
    const existingState: TrusteeMigrationState = {
      documentType: 'TRUSTEE_MIGRATION_STATE',
      lastTrusteeId: 100,
      processedCount: 50,
      appointmentsProcessedCount: 75,
      ambiguousCount: 0,
      errors: 2,
      startedAt: '2024-01-01T00:00:00Z',
      lastUpdatedAt: '2024-01-02T00:00:00Z',
      status: 'IN_PROGRESS',
      divisionMappingVersion: '1.0.0',
    };

    test('should update existing state successfully', async () => {
      mockRepository.read.mockResolvedValue(existingState);
      mockRepository.upsert.mockResolvedValue(undefined);

      const updates = {
        lastTrusteeId: 150,
        processedCount: 75,
      };

      const result = await updateMigrationState(context, updates);

      expect(result.data).toBeUndefined();
      expect(result.error).toBeUndefined();
      expect(mockRepository.read).toHaveBeenCalledWith('TRUSTEE_MIGRATION_STATE');
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingState,
          ...updates,
          lastUpdatedAt: expect.any(String),
        }),
      );
    });

    test('should return error when state does not exist', async () => {
      mockRepository.read.mockResolvedValue(null);

      const result = await updateMigrationState(context, { processedCount: 100 });

      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Cannot update non-existent migration state');
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    test('should handle repository errors during update', async () => {
      mockRepository.read.mockRejectedValue(new Error('Database error'));

      const result = await updateMigrationState(context, { processedCount: 100 });

      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to update migration state');
    });
  });

  describe('completeMigration', () => {
    test('should mark migration as completed', async () => {
      const state: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 200,
        processedCount: 200,
        appointmentsProcessedCount: 300,
        ambiguousCount: 0,
        errors: 0,
        startedAt: '2024-01-01T00:00:00Z',
        lastUpdatedAt: '2024-01-02T00:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRepository.read.mockResolvedValue(state);
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await completeMigration(context, state);

      expect(result.error).toBeUndefined();
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...state,
          status: 'COMPLETED',
          lastUpdatedAt: expect.any(String),
        }),
      );
    });

    test('should return error when state does not exist', async () => {
      const state: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 200,
        processedCount: 200,
        appointmentsProcessedCount: 300,
        ambiguousCount: 0,
        errors: 0,
        startedAt: '2024-01-01T00:00:00Z',
        lastUpdatedAt: '2024-01-02T00:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRepository.read.mockResolvedValue(null);

      const result = await completeMigration(context, state);

      expect(result.error).toBeDefined();
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('failMigration', () => {
    test('should mark migration as failed and log error', async () => {
      const state: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 100,
        appointmentsProcessedCount: 150,
        ambiguousCount: 0,
        errors: 5,
        startedAt: '2024-01-01T00:00:00Z',
        lastUpdatedAt: '2024-01-02T00:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRepository.read.mockResolvedValue(state);
      mockRepository.upsert.mockResolvedValue(undefined);

      const errorMessage = 'Critical database failure';
      const loggerSpy = vi.spyOn(context.logger, 'error');

      const result = await failMigration(context, state, errorMessage);

      expect(result.error).toBeUndefined();
      expect(loggerSpy).toHaveBeenCalledWith(
        'TRUSTEE-MIGRATION-STATE',
        `Migration failed: ${errorMessage}`,
      );
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...state,
          status: 'FAILED',
          lastUpdatedAt: expect.any(String),
        }),
      );
    });

    test('should return error when state does not exist', async () => {
      const state: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 100,
        appointmentsProcessedCount: 150,
        ambiguousCount: 0,
        errors: 5,
        startedAt: '2024-01-01T00:00:00Z',
        lastUpdatedAt: '2024-01-02T00:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRepository.read.mockResolvedValue(null);

      const result = await failMigration(context, state, 'some failure');

      expect(result.error).toBeDefined();
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('resetMigrationState', () => {
    test('should reset migration state to fresh start', async () => {
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await resetMigrationState(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeUndefined();
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'TRUSTEE_MIGRATION_STATE',
          lastTrusteeId: null,
          processedCount: 0,
          appointmentsProcessedCount: 0,
          ambiguousCount: 0,
          errors: 0,
          status: 'IN_PROGRESS',
          divisionMappingVersion: '1.0.0',
          startedAt: expect.any(String),
          lastUpdatedAt: expect.any(String),
        }),
      );
    });

    test('should handle repository errors during reset', async () => {
      mockRepository.upsert.mockRejectedValue(new Error('Database error'));

      const result = await resetMigrationState(context);

      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to reset migration state');
    });
  });

  describe('initHealState', () => {
    const baseState: TrusteeMigrationState = {
      documentType: 'TRUSTEE_MIGRATION_STATE',
      lastTrusteeId: 100,
      processedCount: 50,
      appointmentsProcessedCount: 75,
      ambiguousCount: 0,
      errors: 0,
      startedAt: '2024-01-01T00:00:00Z',
      lastUpdatedAt: '2024-01-02T00:00:00Z',
      status: 'IN_PROGRESS',
      divisionMappingVersion: '1.0.0',
    };

    test('fence-writes zeroed heal counters and IN_PROGRESS with records remaining', async () => {
      mockRepository.read.mockResolvedValue(baseState);
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await initHealState(context, { scanned: 250, pagesTotal: 3 });

      expect(result.error).toBeUndefined();
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          healStatus: 'IN_PROGRESS',
          healScanned: 250,
          healPagesTotal: 3,
          healRecordsRemaining: 250,
          healCreated: 0,
          healAlreadyMapped: 0,
          healUnmatched: 0,
        }),
      );
    });

    test('marks heal COMPLETED immediately when there are no records to scan', async () => {
      mockRepository.read.mockResolvedValue(baseState);
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await initHealState(context, { scanned: 0, pagesTotal: 0 });

      expect(result.error).toBeUndefined();
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ healStatus: 'COMPLETED', healRecordsRemaining: 0 }),
      );
    });
  });

  describe('recordHealPageResult', () => {
    test('atomically increments outcome counters and decrements records remaining', async () => {
      // healRecordsRemaining after decrement is still > 0 → run stays in progress.
      mockRepository.atomicIncrement.mockResolvedValue(10);
      mockRepository.read.mockResolvedValue({} as TrusteeMigrationState);
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await recordHealPageResult(context, {
        created: 2,
        alreadyMapped: 1,
        unmatched: 1,
      });

      expect(result.error).toBeUndefined();
      expect(mockRepository.atomicIncrement).toHaveBeenCalledWith(
        'TRUSTEE_MIGRATION_STATE',
        'healCreated',
        2,
      );
      expect(mockRepository.atomicIncrement).toHaveBeenCalledWith(
        'TRUSTEE_MIGRATION_STATE',
        'healAlreadyMapped',
        1,
      );
      expect(mockRepository.atomicIncrement).toHaveBeenCalledWith(
        'TRUSTEE_MIGRATION_STATE',
        'healUnmatched',
        1,
      );
      // 4 records processed this page → decrement remaining by 4.
      expect(mockRepository.atomicIncrement).toHaveBeenCalledWith(
        'TRUSTEE_MIGRATION_STATE',
        'healRecordsRemaining',
        -4,
      );
    });

    test('marks heal COMPLETED when records remaining reaches zero', async () => {
      // The last (records-remaining) decrement returns 0.
      mockRepository.atomicIncrement.mockImplementation(async (_type, field) =>
        field === 'healRecordsRemaining' ? 0 : 1,
      );
      // updateMigrationState reads the existing doc before merging the COMPLETED flag.
      mockRepository.read.mockResolvedValue({} as TrusteeMigrationState);
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await recordHealPageResult(context, {
        created: 1,
        alreadyMapped: 0,
        unmatched: 0,
      });

      expect(result.data).toBe(0);
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ healStatus: 'COMPLETED' }),
      );
    });

    test('does not decrement when a page processed no records', async () => {
      mockRepository.read.mockResolvedValue({ healRecordsRemaining: 7 } as TrusteeMigrationState);
      mockRepository.upsert.mockResolvedValue(undefined);

      const result = await recordHealPageResult(context, {
        created: 0,
        alreadyMapped: 0,
        unmatched: 0,
      });

      expect(result.data).toBe(7);
      expect(mockRepository.atomicIncrement).not.toHaveBeenCalled();
    });
  });
});
