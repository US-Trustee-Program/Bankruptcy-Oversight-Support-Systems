import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  getOrCreateMigrationState,
  getPageOfTrustees,
  getTrusteeAppointments,
  upsertTrustee,
  processTrusteeWithAppointments,
  processPageOfTrustees,
  getTotalTrusteeCount,
  completeMigration,
  failMigration,
  TrusteeMigrationState,
} from './migrate-trustees';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { AtsTrusteeRecord, AtsAppointmentRecord } from '../../adapters/types/ats.types';

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
      createTrustee: vi.fn(),
      updateTrustee: vi.fn(),
    };

    mockAppointmentsRepo = {
      getTrusteeAppointments: vi.fn().mockResolvedValue([]),
      createAppointment: vi.fn(),
      updateAppointment: vi.fn(),
    };

    mockRuntimeStateRepo = {
      read: vi.fn(),
      upsert: vi.fn(),
    };

    vi.spyOn(factory, 'getAtsGateway').mockReturnValue(mockAtsGateway);
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(mockTrusteesRepo);
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(mockAppointmentsRepo);
    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(mockRuntimeStateRepo);
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
  });

  describe('getTrusteeAppointments', () => {
    test('should get appointments for a trustee', async () => {
      const mockAppointments: AtsAppointmentRecord[] = [
        {
          ID: 1,
          DISTRICT: '02',
          DIVISION: '081',
          CHAPTER: '7',
          STATUS: 'PA',
        },
      ];

      mockAtsGateway.getTrusteeAppointments.mockResolvedValue(mockAppointments);

      const result = await getTrusteeAppointments(context, 1);

      expect(result.data).toEqual(mockAppointments);
      expect(mockAtsGateway.getTrusteeAppointments).toHaveBeenCalledWith(context, 1);
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

      mockTrusteesRepo.listTrustees.mockResolvedValue([]);
      mockTrusteesRepo.createTrustee.mockResolvedValue(createdTrustee);

      const result = await upsertTrustee(context, atsTrustee);

      expect(result.data).toEqual(createdTrustee);
      expect(mockTrusteesRepo.createTrustee).toHaveBeenCalled();
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

      mockTrusteesRepo.listTrustees.mockResolvedValue([existingTrustee]);
      mockTrusteesRepo.updateTrustee.mockResolvedValue(updatedTrustee);

      const result = await upsertTrustee(context, atsTrustee);

      expect(result.data).toEqual(updatedTrustee);
      expect(mockTrusteesRepo.updateTrustee).toHaveBeenCalledWith(
        'trustee-123',
        expect.anything(),
        expect.anything(),
      );
      expect(mockTrusteesRepo.createTrustee).not.toHaveBeenCalled();
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

      const mockAppointments: AtsAppointmentRecord[] = [
        {
          ID: 1,
          DISTRICT: '02',
          DIVISION: '081',
          CHAPTER: '7',
          STATUS: 'PA',
        },
      ];

      mockTrusteesRepo.listTrustees.mockResolvedValue([]);
      mockTrusteesRepo.createTrustee.mockResolvedValue(createdTrustee);
      mockAtsGateway.getTrusteeAppointments.mockResolvedValue(mockAppointments);
      mockAppointmentsRepo.getTrusteeAppointments.mockResolvedValue([]);
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

      mockTrusteesRepo.listTrustees.mockResolvedValue([]);
      mockTrusteesRepo.createTrustee.mockResolvedValue(createdTrustee);
      mockAtsGateway.getTrusteeAppointments.mockResolvedValue([]);

      const result = await processTrusteeWithAppointments(context, atsTrustee);

      expect(result.success).toBe(true);
      expect(result.appointmentsProcessed).toBe(0);
    });
  });

  describe('processPageOfTrustees', () => {
    test('should process multiple trustees', async () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe' },
        { ID: 2, FIRST_NAME: 'Jane', LAST_NAME: 'Smith' },
      ];

      mockTrusteesRepo.listTrustees.mockResolvedValue([]);
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

      mockRuntimeStateRepo.upsert.mockResolvedValue(undefined);

      const result = await completeMigration(context, state);

      expect(result.error).toBeUndefined();
      expect(mockRuntimeStateRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'COMPLETED',
        }),
      );
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
