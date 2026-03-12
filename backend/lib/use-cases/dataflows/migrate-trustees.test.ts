import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  getPageOfTrustees,
  getTrusteeAppointments,
  upsertTrustee,
  createAppointments,
  processTrusteeWithAppointments,
  processPageOfTrustees,
  getTotalTrusteeCount,
} from './migrate-trustees';
import {
  getOrCreateMigrationState,
  completeMigration,
  failMigration,
  TrusteeMigrationState,
} from './trustee-migration-state.service';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { AtsTrusteeRecord } from '../../adapters/types/ats.types';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';

describe('Migrate Trustees Use Case', () => {
  let context: ApplicationContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAtsGateway: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockTrusteesRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAppointmentsRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRuntimeStateRepo: any;

  beforeEach(async () => {
    context = await createMockApplicationContext();

    // Mock the factory methods
    mockAtsGateway = {
      getTrusteesPage: vi.fn(),
      getTrusteeAppointments: vi.fn(),
      getTrusteeCount: vi.fn(),
    };

    mockTrusteesRepo = {
      listTrustees: vi.fn().mockResolvedValue([]),
      findTrusteeByLegacyTruId: vi.fn().mockResolvedValue(null),
      createTrustee: vi.fn(),
      updateTrustee: vi.fn(),
    };

    mockAppointmentsRepo = {
      createAppointment: vi.fn(),
      getTrusteeAppointments: vi.fn().mockResolvedValue([]),
    };

    mockRuntimeStateRepo = {
      read: vi.fn(),
      upsert: vi.fn(),
    };

    vi.spyOn(factory, 'getAtsGateway').mockReturnValue(mockAtsGateway);
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(mockTrusteesRepo);
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(mockAppointmentsRepo);
    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(mockRuntimeStateRepo);

    // NOTE: We let the cleansing pipeline run for real so it can properly classify
    // valid vs invalid data. Tests will use real representative ATS data.
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateMigrationState', () => {
    test('should create new state when none exists', async () => {
      mockRuntimeStateRepo.read.mockRejectedValue(new Error('Not found'));
      mockRuntimeStateRepo.upsert.mockResolvedValue(undefined);

      const result = await getOrCreateMigrationState(context);

      expect(result.data).toBeDefined();
      expect(result.data?.documentType).toBe('TRUSTEE_MIGRATION_STATE');
      expect(result.data?.status).toBe('IN_PROGRESS');
      expect(result.data?.lastTrusteeId).toBeNull();
      expect(mockRuntimeStateRepo.upsert).toHaveBeenCalled();
    });

    test('should return existing state when found', async () => {
      const existingState: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 50,
        appointmentsProcessedCount: 150,
        errors: 2,
        startedAt: '2023-01-01T00:00:00Z',
        lastUpdatedAt: '2023-01-01T01:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRuntimeStateRepo.read.mockResolvedValue(existingState);

      const result = await getOrCreateMigrationState(context);

      expect(result.data).toEqual(existingState);
      expect(mockRuntimeStateRepo.upsert).not.toHaveBeenCalled();
    });

    test('should handle error when creating state fails', async () => {
      mockRuntimeStateRepo.read.mockRejectedValue(new Error('Not found'));
      mockRuntimeStateRepo.upsert.mockRejectedValue(new Error('Database write failed'));

      const result = await getOrCreateMigrationState(context);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to get or create migration state');
      expect(result.data).toBeUndefined();
    });
  });

  describe('getPageOfTrustees', () => {
    test('should get page of trustees from ATS', async () => {
      const mockTrustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe' },
        { ID: 2, FIRST_NAME: 'Jane', LAST_NAME: 'Smith' },
      ];

      mockAtsGateway.getTrusteesPage.mockResolvedValue(mockTrustees);

      const result = await getPageOfTrustees(context, null, 2);

      expect(result.data?.trustees).toEqual(mockTrustees);
      expect(result.data?.hasMore).toBe(true); // Has more when page is full
      expect(result.data?.totalProcessed).toBe(2);
    });

    test('should indicate no more pages when less than page size returned', async () => {
      const mockTrustees: AtsTrusteeRecord[] = [{ ID: 3, FIRST_NAME: 'Bob', LAST_NAME: 'Johnson' }];

      mockAtsGateway.getTrusteesPage.mockResolvedValue(mockTrustees);

      const result = await getPageOfTrustees(context, 2, 2);

      expect(result.data?.trustees).toEqual(mockTrustees);
      expect(result.data?.hasMore).toBe(false);
    });

    test('should handle error when getting page fails', async () => {
      mockAtsGateway.getTrusteesPage.mockRejectedValue(new Error('Database connection failed'));

      const result = await getPageOfTrustees(context, null, 10);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to get page of trustees');
      expect(result.data).toBeUndefined();
    });
  });

  describe('getTrusteeAppointments', () => {
    test('should get appointments for a trustee', async () => {
      const mockAppointments: TrusteeAppointmentInput[] = [
        {
          chapter: '7',
          appointmentType: 'panel',
          courtId: '053N',
          appointedDate: '2023-01-15',
          status: 'active',
          effectiveDate: '2023-01-15',
        },
      ];

      mockAtsGateway.getTrusteeAppointments.mockResolvedValue({
        cleanAppointments: mockAppointments,
        failedAppointments: [],
        stats: {
          total: 1,
          clean: 1,
          autoRecoverable: 0,
          problematic: 0,
          uncleansable: 0,
        },
      });

      const result = await getTrusteeAppointments(context, 1);

      expect(result.data?.cleanAppointments).toEqual(mockAppointments);
      expect(mockAtsGateway.getTrusteeAppointments).toHaveBeenCalledWith(context, 1);
    });

    test('should handle error when getting appointments fails', async () => {
      mockAtsGateway.getTrusteeAppointments.mockRejectedValue(new Error('Database error'));

      const result = await getTrusteeAppointments(context, 1);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to get appointments for trustee 1');
      expect(result.data).toBeUndefined();
    });
  });

  describe('upsertTrustee', () => {
    test('should create new trustee when none exists', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
      };

      const createdTrustee = {
        id: 'new-id',
        trusteeId: 'trustee-123',
        name: 'John Doe',
      };

      mockTrusteesRepo.findTrusteeByLegacyTruId.mockResolvedValue(null);
      mockTrusteesRepo.createTrustee.mockResolvedValue(createdTrustee);

      const result = await upsertTrustee(context, atsTrustee);

      expect(result.data).toEqual(createdTrustee);
      expect(mockTrusteesRepo.createTrustee).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
        expect.anything(),
      );
      expect(mockTrusteesRepo.updateTrustee).not.toHaveBeenCalled();
    });

    test('should update existing trustee when found', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
      };

      const existingTrustee = {
        id: 'existing-id',
        trusteeId: 'trustee-123',
        name: 'John Doe',
        legacy: { truId: '1' },
      };

      const updatedTrustee = {
        ...existingTrustee,
        name: 'John Doe',
      };

      mockTrusteesRepo.findTrusteeByLegacyTruId.mockResolvedValue(existingTrustee);
      mockTrusteesRepo.updateTrustee.mockResolvedValue(updatedTrustee);

      const result = await upsertTrustee(context, atsTrustee);

      expect(result.data).toEqual(updatedTrustee);
      expect(mockTrusteesRepo.updateTrustee).toHaveBeenCalledWith(
        'trustee-123',
        expect.objectContaining({ status: 'active' }),
        expect.anything(),
      );
      expect(mockTrusteesRepo.createTrustee).not.toHaveBeenCalled();
    });

    test('should handle error when upsert fails', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
      };

      mockTrusteesRepo.findTrusteeByLegacyTruId.mockRejectedValue(new Error('Database error'));

      const result = await upsertTrustee(context, atsTrustee);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to upsert trustee 1');
      expect(result.data).toBeUndefined();
    });
  });

  describe('createAppointments', () => {
    const mockTrustee = {
      id: 'doc-id',
      trusteeId: 'trustee-100',
      name: 'Test Trustee',
      status: 'active' as const,
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' as const },
      },
      createdOn: '2023-01-01',
      updatedOn: '2023-01-01',
      updatedBy: { id: 'SYSTEM', name: 'System' },
    };

    test('should create new appointments', async () => {
      // Gateway provides clean CAMS domain types
      const cleanAppointments: TrusteeAppointmentInput[] = [
        {
          chapter: '7',
          appointmentType: 'panel',
          courtId: '053N', // Middle Louisiana
          appointedDate: '2023-01-15',
          status: 'active',
          effectiveDate: '2023-01-15',
        },
      ];

      mockAppointmentsRepo.createAppointment.mockResolvedValue({});

      const result = await createAppointments(context, mockTrustee, cleanAppointments);

      expect(result.data?.successCount).toBe(1);
      expect(mockAppointmentsRepo.createAppointment).toHaveBeenCalledTimes(1);
    });

    test('should skip duplicate appointments in source data', async () => {
      // Gateway might return duplicates after multi-expansion - use case deduplicates
      const cleanAppointments: TrusteeAppointmentInput[] = [
        {
          chapter: '7',
          appointmentType: 'panel',
          courtId: '053N',
          appointedDate: '2023-01-15',
          status: 'active',
          effectiveDate: '2023-01-15',
        },
        {
          chapter: '7',
          appointmentType: 'panel',
          courtId: '053N',
          appointedDate: '2023-01-15',
          status: 'active',
          effectiveDate: '2023-01-15',
        },
      ];

      mockAppointmentsRepo.createAppointment.mockResolvedValue({});

      const result = await createAppointments(context, mockTrustee, cleanAppointments);

      // Both are successfully processed (one created, one skipped as duplicate)
      expect(result.data?.successCount).toBe(2);
      // Only one was actually created in the repository
      expect(mockAppointmentsRepo.createAppointment).toHaveBeenCalledTimes(1);
    });

    test('should skip appointments that already exist in database', async () => {
      const existingAppointment = {
        id: 'existing-id',
        trusteeId: 'trustee-100',
        chapter: '7',
        appointmentType: 'panel',
        courtId: '053N',
        appointedDate: '2023-01-15',
        status: 'active',
        effectiveDate: '2023-01-15',
      };

      mockAppointmentsRepo.getTrusteeAppointments.mockResolvedValue([existingAppointment]);

      const cleanAppointments: TrusteeAppointmentInput[] = [
        {
          chapter: '7',
          appointmentType: 'panel',
          courtId: '053N',
          appointedDate: '2023-01-15',
          status: 'active',
          effectiveDate: '2023-01-15',
        },
      ];

      const result = await createAppointments(context, mockTrustee, cleanAppointments);

      expect(result.data?.successCount).toBe(1);
      expect(mockAppointmentsRepo.createAppointment).not.toHaveBeenCalled();
    });

    test('should handle error when creating appointments fails', async () => {
      const cleanAppointments: TrusteeAppointmentInput[] = [
        {
          chapter: '7',
          appointmentType: 'panel',
          courtId: '053N',
          appointedDate: '2023-01-15',
          status: 'active',
          effectiveDate: '2023-01-15',
        },
      ];

      mockAppointmentsRepo.createAppointment.mockRejectedValue(new Error('Database write failed'));

      const result = await createAppointments(context, mockTrustee, cleanAppointments);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to create appointments for trustee');
      expect(result.data).toBeUndefined();
    });
  });

  describe('processTrusteeWithAppointments', () => {
    test('should process trustee with appointments successfully', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
      };

      const createdTrustee = {
        id: 'new-id',
        trusteeId: 'trustee-123',
        name: 'John Doe',
      };

      // Gateway returns clean CAMS types
      const cleanAppointments: TrusteeAppointmentInput[] = [
        {
          chapter: '7',
          appointmentType: 'panel',
          courtId: '053N',
          appointedDate: '2023-01-15',
          status: 'active',
          effectiveDate: '2023-01-15',
        },
      ];

      mockTrusteesRepo.findTrusteeByLegacyTruId.mockResolvedValue(null);
      mockTrusteesRepo.createTrustee.mockResolvedValue(createdTrustee);
      mockAtsGateway.getTrusteeAppointments.mockResolvedValue({
        cleanAppointments,
        failedAppointments: [],
        stats: {
          total: 1,
          clean: 1,
          autoRecoverable: 0,
          problematic: 0,
          uncleansable: 0,
        },
      });
      mockAppointmentsRepo.createAppointment.mockResolvedValue({});

      const result = await processTrusteeWithAppointments(context, atsTrustee);

      expect(result.success).toBe(true);
      expect(result.trusteeId).toBe('trustee-123');
      expect(result.truId).toBe('1');
      expect(result.appointmentsProcessed).toBe(1);
    });

    test('should handle trustee with no appointments', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 2,
        FIRST_NAME: 'Jane',
        LAST_NAME: 'Smith',
      };

      const createdTrustee = {
        id: 'new-id',
        trusteeId: 'trustee-456',
        name: 'Jane Smith',
      };

      mockTrusteesRepo.findTrusteeByLegacyTruId.mockResolvedValue(null);
      mockTrusteesRepo.createTrustee.mockResolvedValue(createdTrustee);
      mockAtsGateway.getTrusteeAppointments.mockResolvedValue([]);

      const result = await processTrusteeWithAppointments(context, atsTrustee);

      expect(result.success).toBe(true);
      expect(result.appointmentsProcessed).toBe(0);
    });

    test('should handle error when upserting trustee fails', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 3,
        FIRST_NAME: 'Bob',
        LAST_NAME: 'Johnson',
      };

      mockTrusteesRepo.findTrusteeByLegacyTruId.mockRejectedValue(
        new Error('Database connection lost'),
      );

      const result = await processTrusteeWithAppointments(context, atsTrustee);

      expect(result.success).toBe(false);
      expect(result.truId).toBe('3');
      expect(result.appointmentsProcessed).toBe(0);
      expect(result.error).toBeDefined();
    });

    test('should continue processing trustee when getting appointments fails', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 4,
        FIRST_NAME: 'Alice',
        LAST_NAME: 'Williams',
      };

      const createdTrustee = {
        id: 'new-id',
        trusteeId: 'trustee-789',
        name: 'Alice Williams',
      };

      mockTrusteesRepo.findTrusteeByLegacyTruId.mockResolvedValue(null);
      mockTrusteesRepo.createTrustee.mockResolvedValue(createdTrustee);
      mockAtsGateway.getTrusteeAppointments.mockRejectedValue(new Error('ATS connection timeout'));

      const result = await processTrusteeWithAppointments(context, atsTrustee);

      // Trustee should be processed successfully even though appointments failed
      expect(result.success).toBe(true);
      expect(result.trusteeId).toBe('trustee-789');
      expect(result.appointmentsProcessed).toBe(0);
    });

    test('should continue processing trustee when creating appointments fails', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 5,
        FIRST_NAME: 'Charlie',
        LAST_NAME: 'Brown',
      };

      const createdTrustee = {
        id: 'new-id',
        trusteeId: 'trustee-999',
        name: 'Charlie Brown',
      };

      const cleanAppointments: TrusteeAppointmentInput[] = [
        {
          chapter: '7',
          appointmentType: 'panel',
          courtId: '053N',
          appointedDate: '2023-01-15',
          status: 'active',
          effectiveDate: '2023-01-15',
        },
      ];

      mockTrusteesRepo.findTrusteeByLegacyTruId.mockResolvedValue(null);
      mockTrusteesRepo.createTrustee.mockResolvedValue(createdTrustee);
      mockAtsGateway.getTrusteeAppointments.mockResolvedValue(cleanAppointments);
      mockAppointmentsRepo.createAppointment.mockRejectedValue(
        new Error('Appointment database error'),
      );

      const result = await processTrusteeWithAppointments(context, atsTrustee);

      // Trustee should be processed successfully even though appointments failed
      expect(result.success).toBe(true);
      expect(result.trusteeId).toBe('trustee-999');
      expect(result.appointmentsProcessed).toBe(0);
    });
  });

  describe('processPageOfTrustees', () => {
    test('should process multiple trustees', async () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe' },
        { ID: 2, FIRST_NAME: 'Jane', LAST_NAME: 'Smith' },
      ];

      mockTrusteesRepo.findTrusteeByLegacyTruId.mockResolvedValue(null);
      mockTrusteesRepo.createTrustee.mockResolvedValue({
        id: 'new-id',
        trusteeId: 'trustee-123',
        name: 'Test',
      });
      mockAtsGateway.getTrusteeAppointments.mockResolvedValue([]);

      const result = await processPageOfTrustees(context, trustees);

      expect(result.data?.processed).toBe(2);
      expect(result.data?.errors).toBe(0);
    });
  });

  describe('getTotalTrusteeCount', () => {
    test('should get total count from ATS', async () => {
      mockAtsGateway.getTrusteeCount.mockResolvedValue(500);

      const result = await getTotalTrusteeCount(context);

      expect(result.data).toBe(500);
      expect(mockAtsGateway.getTrusteeCount).toHaveBeenCalledWith(context);
    });

    test('should handle error when getting count fails', async () => {
      mockAtsGateway.getTrusteeCount.mockRejectedValue(new Error('Database timeout'));

      const result = await getTotalTrusteeCount(context);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to get total trustee count');
      expect(result.data).toBeUndefined();
    });
  });

  describe('completeMigration', () => {
    test('should mark migration as completed', async () => {
      const state: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 100,
        appointmentsProcessedCount: 300,
        errors: 0,
        startedAt: '2023-01-01T00:00:00Z',
        lastUpdatedAt: '2023-01-01T01:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRuntimeStateRepo.read.mockResolvedValue(state);
      mockRuntimeStateRepo.upsert.mockResolvedValue(undefined);

      const result = await completeMigration(context, state);

      expect(result.error).toBeUndefined();
      expect(mockRuntimeStateRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'COMPLETED',
        }),
      );
    });

    test('should handle error when migration state does not exist', async () => {
      const state: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 100,
        appointmentsProcessedCount: 300,
        errors: 0,
        startedAt: '2023-01-01T00:00:00Z',
        lastUpdatedAt: '2023-01-01T01:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRuntimeStateRepo.read.mockResolvedValue(null);

      const result = await completeMigration(context, state);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Cannot update non-existent migration state');
    });

    test('should handle error when updating state fails', async () => {
      const state: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 100,
        processedCount: 100,
        appointmentsProcessedCount: 300,
        errors: 0,
        startedAt: '2023-01-01T00:00:00Z',
        lastUpdatedAt: '2023-01-01T01:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRuntimeStateRepo.read.mockResolvedValue(state);
      mockRuntimeStateRepo.upsert.mockRejectedValue(new Error('Database write error'));

      const result = await completeMigration(context, state);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to update migration state');
    });
  });

  describe('failMigration', () => {
    test('should mark migration as failed', async () => {
      const state: TrusteeMigrationState = {
        documentType: 'TRUSTEE_MIGRATION_STATE',
        lastTrusteeId: 50,
        processedCount: 50,
        appointmentsProcessedCount: 150,
        errors: 5,
        startedAt: '2023-01-01T00:00:00Z',
        lastUpdatedAt: '2023-01-01T01:00:00Z',
        status: 'IN_PROGRESS',
        divisionMappingVersion: '1.0.0',
      };

      mockRuntimeStateRepo.read.mockResolvedValue(state);
      mockRuntimeStateRepo.upsert.mockResolvedValue(undefined);

      const result = await failMigration(context, state, 'Test error');

      expect(result.error).toBeUndefined();
      expect(mockRuntimeStateRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
        }),
      );
    });
  });
});
