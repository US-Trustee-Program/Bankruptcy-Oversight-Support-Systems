import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import {
  getOrCreateMigrationState,
  updateMigrationState,
  completeMigration,
  failMigration,
  TrusteeMigrationState,
} from './trustee-migration-state.service';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { RuntimeStateRepository } from '../gateways.types';

describe('trustee-migration-state.service', () => {
  let context: ApplicationContext;
  let mockRepository: vi.Mocked<RuntimeStateRepository<TrusteeMigrationState>>;

  beforeEach(async () => {
    context = await createMockApplicationContext();

    mockRepository = {
      read: vi.fn(),
      upsert: vi.fn(),
      release: vi.fn(),
    };

    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(mockRepository);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOrCreateMigrationState', () => {
    test('should return existing state when found', async () => {
      const existingState: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 50,
        appointmentsProcessedCount: 75,
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
      const existingState: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 50,
        appointmentsProcessedCount: 75,
        errors: 2,
        startedAt: '2024-01-01T00:00:00Z',
        lastUpdatedAt: '2024-01-02T00:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRepository.read.mockResolvedValue(existingState);
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

  describe('updateMigrationState', () => {
    const existingState: TrusteeMigrationState = {
      documentType: 'TRUSTEE_MIGRATION_STATE',
      lastTrusteeId: 100,
      processedCount: 50,
      appointmentsProcessedCount: 75,
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
  });

  describe('failMigration', () => {
    test('should mark migration as failed and log error', async () => {
      const state: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 100,
        appointmentsProcessedCount: 150,
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
  });
});
