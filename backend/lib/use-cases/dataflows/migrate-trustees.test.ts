import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  getPageOfTrustees,
  getTrusteeAppointments,
  upsertTrustee,
  createAppointments,
  processTrusteeWithAppointments,
  processPageOfTrustees,
  getTotalTrusteeCount,
  deleteAllTrusteesAndAppointments,
  mergeTrusteeRecords,
  upsertProfessionalIds,
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
import { AcmsGateway, AtsGateway } from '../../use-cases/gateways.types';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

/**
 * Helper function to wrap a single trustee for the new merged data format.
 * For backward compatibility with existing tests.
 */
function wrapTrusteeForProcessing(atsTrustee: AtsTrusteeRecord) {
  return mergeTrusteeRecords([atsTrustee]);
}

describe('Migrate Trustees Use Case', () => {
  let context: ApplicationContext;
  let atsGateway: AtsGateway;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    atsGateway = factory.getAtsGateway(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOrCreateMigrationState', () => {
    test('should create new state when none exists', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new Error('Not found'));
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);

      const result = await getOrCreateMigrationState(context);

      expect(result.data).toBeDefined();
      expect(result.data?.documentType).toBe('TRUSTEE_MIGRATION_STATE');
      expect(result.data?.status).toBe('IN_PROGRESS');
      expect(result.data?.lastTrusteeId).toBeNull();
      expect(upsertSpy).toHaveBeenCalled();
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

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert');

      const result = await getOrCreateMigrationState(context);

      expect(result.data).toEqual(existingState);
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    test('should handle error when creating state fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new Error('Not found'));
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(
        new Error('Database write failed'),
      );

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

      vi.spyOn(atsGateway, 'getTrusteesPage').mockResolvedValue(mockTrustees);

      const result = await getPageOfTrustees(context, null, 2);

      expect(result.data?.trustees).toEqual(mockTrustees);
      expect(result.data?.hasMore).toBe(true); // Has more when page is full
      expect(result.data?.totalProcessed).toBe(2);
    });

    test('should indicate no more pages when less than page size returned', async () => {
      const mockTrustees: AtsTrusteeRecord[] = [{ ID: 3, FIRST_NAME: 'Bob', LAST_NAME: 'Johnson' }];

      vi.spyOn(atsGateway, 'getTrusteesPage').mockResolvedValue(mockTrustees);

      const result = await getPageOfTrustees(context, 2, 2);

      expect(result.data?.trustees).toEqual(mockTrustees);
      expect(result.data?.hasMore).toBe(false);
    });

    test('should handle error when getting page fails', async () => {
      vi.spyOn(atsGateway, 'getTrusteesPage').mockRejectedValue(
        new Error('Database connection failed'),
      );

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

      const getTrusteeAppointmentsSpy = vi
        .spyOn(atsGateway, 'getTrusteeAppointments')
        .mockResolvedValue({
          cleanAppointments: mockAppointments,
          failedAppointments: [],
          stats: {
            total: 1,
            clean: 1,
            autoRecoverable: 0,
            problematic: 0,
            uncleansable: 0,
            skipped: 0,
          },
        });

      const result = await getTrusteeAppointments(context, 1);

      expect(result.data?.cleanAppointments).toEqual(mockAppointments);
      expect(getTrusteeAppointmentsSpy).toHaveBeenCalledWith(context, 1);
    });

    test('should handle error when getting appointments fails', async () => {
      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockRejectedValue(new Error('Database error'));

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
        STATE: 'NY',
      };

      const createdTrustee = {
        id: 'new-id',
        trusteeId: 'trustee-123',
        name: 'John Doe',
      };

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      const createTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrustee')
        .mockResolvedValue(createdTrustee);
      const updateTrusteeSpy = vi.spyOn(MockMongoRepository.prototype, 'updateTrustee');

      const mergedData = wrapTrusteeForProcessing(atsTrustee);
      const result = await upsertTrustee(context, mergedData);

      expect(result.data).toEqual(createdTrustee);
      expect(createTrusteeSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
        expect.anything(),
      );
      expect(updateTrusteeSpy).not.toHaveBeenCalled();
    });

    test('should update existing trustee when found', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      const existingTrustee = {
        id: 'existing-id',
        trusteeId: 'trustee-123',
        name: 'John Doe',
        legacy: { truIds: ['1'] },
        public: {
          address: { address1: '', city: '', state: 'NY', zipCode: '', countryCode: 'US' as const },
        },
        updatedOn: '2023-01-01T00:00:00Z',
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      };

      const updatedTrustee = {
        ...existingTrustee,
        name: 'John Doe',
      };

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(
        existingTrustee,
      );
      const updateTrusteeSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateTrustee')
        .mockResolvedValue(updatedTrustee);
      const createTrusteeSpy = vi.spyOn(MockMongoRepository.prototype, 'createTrustee');

      const mergedData = wrapTrusteeForProcessing(atsTrustee);
      const result = await upsertTrustee(context, mergedData);

      expect(result.data).toEqual(updatedTrustee);
      expect(updateTrusteeSpy).toHaveBeenCalledWith(
        'trustee-123',
        expect.objectContaining({ status: 'active' }),
        expect.anything(),
      );
      expect(createTrusteeSpy).not.toHaveBeenCalled();
    });

    test('should handle error when upsert fails', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockRejectedValue(
        new Error('Database error'),
      );

      const mergedData = wrapTrusteeForProcessing(atsTrustee);
      const result = await upsertTrustee(context, mergedData);

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

      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockResolvedValue([]);
      const createAppointmentSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createAppointment')
        .mockResolvedValue({});

      const result = await createAppointments(context, mockTrustee, cleanAppointments);

      expect(result.data?.successCount).toBe(1);
      expect(createAppointmentSpy).toHaveBeenCalledTimes(1);
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

      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockResolvedValue([]);
      const createAppointmentSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createAppointment')
        .mockResolvedValue({});

      const result = await createAppointments(context, mockTrustee, cleanAppointments);

      // Both are successfully processed (one created, one skipped as duplicate)
      expect(result.data?.successCount).toBe(2);
      // Only one was actually created in the repository
      expect(createAppointmentSpy).toHaveBeenCalledTimes(1);
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

      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockResolvedValue([
        existingAppointment,
      ]);

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

      const createAppointmentSpy = vi.spyOn(MockMongoRepository.prototype, 'createAppointment');

      const result = await createAppointments(context, mockTrustee, cleanAppointments);

      expect(result.data?.successCount).toBe(1);
      expect(createAppointmentSpy).not.toHaveBeenCalled();
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

      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockRejectedValue(
        new Error('Database write failed'),
      );

      const result = await createAppointments(context, mockTrustee, cleanAppointments);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to create appointments for trustee');
      expect(result.data).toBeUndefined();
    });
  });

  describe('upsertProfessionalIds', () => {
    test('should store all professional IDs returned by ACMS gateway', async () => {
      const mockAcmsGateway = {
        getTrusteeProfessionalIds: vi.fn().mockResolvedValue(['NY-00063', 'UT-05321']),
      };
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue(
        mockAcmsGateway as unknown as AcmsGateway,
      );
      const createProfIdSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createProfessionalId')
        .mockResolvedValue({
          id: 'pid-1',
          camsTrusteeId: 'trustee-123',
          acmsProfessionalId: 'NY-00063',
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          updatedOn: '2026-01-01T00:00:00.000Z',
          updatedBy: { id: 'SYSTEM', name: 'ATS Migration' },
        } as unknown as never);

      const count = await upsertProfessionalIds(context, 'trustee-123', 'Harvey', 'Barr', 'NY');

      expect(count).toBe(2);
      expect(mockAcmsGateway.getTrusteeProfessionalIds).toHaveBeenCalledWith(
        context,
        'Harvey',
        'Barr',
        'NY',
      );
      expect(createProfIdSpy).toHaveBeenCalledTimes(2);
    });

    test('should return 0 when ACMS returns no matches', async () => {
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getTrusteeProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);
      const createProfIdSpy = vi.spyOn(MockMongoRepository.prototype, 'createProfessionalId');

      const count = await upsertProfessionalIds(context, 'trustee-456', 'Jane', 'Smith', 'CA');

      expect(count).toBe(0);
      expect(createProfIdSpy).not.toHaveBeenCalled();
    });

    test('should return 0 and not throw when ACMS gateway fails', async () => {
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getTrusteeProfessionalIds: vi.fn().mockRejectedValue(new Error('ACMS unavailable')),
      } as unknown as AcmsGateway);

      const count = await upsertProfessionalIds(context, 'trustee-789', 'Bob', 'Jones', 'TX');

      expect(count).toBe(0);
    });

    test('should continue and count only successful stores when one createProfessionalId fails', async () => {
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getTrusteeProfessionalIds: vi.fn().mockResolvedValue(['WA-00001', 'WA-00002']),
      } as unknown as AcmsGateway);
      vi.spyOn(MockMongoRepository.prototype, 'createProfessionalId')
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({
          id: 'pid-2',
          camsTrusteeId: 'trustee-abc',
          acmsProfessionalId: 'WA-00002',
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          updatedOn: '2026-01-01T00:00:00.000Z',
          updatedBy: { id: 'SYSTEM', name: 'ATS Migration' },
        } as unknown as never);

      const count = await upsertProfessionalIds(context, 'trustee-abc', 'Alice', 'Wu', 'WA');

      expect(count).toBe(1);
    });
  });

  describe('processTrusteeWithAppointments', () => {
    beforeEach(() => {
      // Stub ACMS gateway so upsertProfessionalIds does not reach the network
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getTrusteeProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);
    });

    test('should process trustee with appointments successfully', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
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

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(createdTrustee);
      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockResolvedValue({
        cleanAppointments,
        failedAppointments: [],
        stats: {
          total: 1,
          clean: 1,
          autoRecoverable: 0,
          problematic: 0,
          uncleansable: 0,
          skipped: 0,
        },
      });
      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockResolvedValue([]);
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockResolvedValue({});

      const mergedData = wrapTrusteeForProcessing(atsTrustee);
      const result = await processTrusteeWithAppointments(context, mergedData);

      expect(result.success).toBe(true);
      expect(result.trusteeId).toBe('trustee-123');
      expect(result.todIds).toEqual(['1']);
      expect(result.appointmentsProcessed).toBe(1);
    });

    test('should handle trustee with no appointments', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 2,
        FIRST_NAME: 'Jane',
        LAST_NAME: 'Smith',
        STATE: 'CA',
      };

      const createdTrustee = {
        id: 'new-id',
        trusteeId: 'trustee-456',
        name: 'Jane Smith',
      };

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(createdTrustee);
      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockResolvedValue({
        cleanAppointments: [],
        failedAppointments: [],
        stats: {
          total: 0,
          clean: 0,
          autoRecoverable: 0,
          problematic: 0,
          uncleansable: 0,
          skipped: 0,
        },
      });

      const mergedData = wrapTrusteeForProcessing(atsTrustee);
      const result = await processTrusteeWithAppointments(context, mergedData);

      expect(result.success).toBe(true);
      expect(result.appointmentsProcessed).toBe(0);
    });

    test('should handle error when upserting trustee fails', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 3,
        FIRST_NAME: 'Bob',
        LAST_NAME: 'Johnson',
        STATE: 'TX',
      };

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockRejectedValue(
        new Error('Database connection lost'),
      );

      const mergedData = wrapTrusteeForProcessing(atsTrustee);
      const result = await processTrusteeWithAppointments(context, mergedData);

      expect(result.success).toBe(false);
      expect(result.todIds).toEqual(['3']);
      expect(result.appointmentsProcessed).toBe(0);
      expect(result.error).toBeDefined();
    });

    test('should continue processing trustee when getting appointments fails', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 4,
        FIRST_NAME: 'Alice',
        LAST_NAME: 'Williams',
        STATE: 'FL',
      };

      const createdTrustee = {
        id: 'new-id',
        trusteeId: 'trustee-789',
        name: 'Alice Williams',
      };

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(createdTrustee);
      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockRejectedValue(
        new Error('ATS connection timeout'),
      );

      const mergedData = wrapTrusteeForProcessing(atsTrustee);
      const result = await processTrusteeWithAppointments(context, mergedData);

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
        STATE: 'IL',
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

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(createdTrustee);
      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockResolvedValue({
        cleanAppointments,
        failedAppointments: [],
        stats: {
          total: 1,
          clean: 1,
          autoRecoverable: 0,
          problematic: 0,
          uncleansable: 0,
          skipped: 0,
        },
      });
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockRejectedValue(
        new Error('Appointment database error'),
      );

      const mergedData = wrapTrusteeForProcessing(atsTrustee);
      const result = await processTrusteeWithAppointments(context, mergedData);

      // Trustee should be processed successfully even though appointments failed
      expect(result.success).toBe(true);
      expect(result.trusteeId).toBe('trustee-999');
      expect(result.appointmentsProcessed).toBe(0);
    });
  });

  describe('processPageOfTrustees', () => {
    test('should process multiple trustees', async () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' },
        { ID: 2, FIRST_NAME: 'Jane', LAST_NAME: 'Smith', STATE: 'CA' },
      ];

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue({
        id: 'new-id',
        trusteeId: 'trustee-123',
        name: 'Test',
      });
      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockResolvedValue({
        cleanAppointments: [],
        failedAppointments: [],
        stats: {
          total: 0,
          clean: 0,
          autoRecoverable: 0,
          problematic: 0,
          uncleansable: 0,
          skipped: 0,
        },
      });

      const result = await processPageOfTrustees(context, trustees);

      expect(result.data?.processed).toBe(2);
      expect(result.data?.errors).toBe(0);
    });
  });

  describe('getTotalTrusteeCount', () => {
    test('should get total count from ATS', async () => {
      const getTrusteeCountSpy = vi.spyOn(atsGateway, 'getTrusteeCount').mockResolvedValue(500);

      const result = await getTotalTrusteeCount(context);

      expect(result.data).toBe(500);
      expect(getTrusteeCountSpy).toHaveBeenCalledWith(context);
    });

    test('should handle error when getting count fails', async () => {
      vi.spyOn(atsGateway, 'getTrusteeCount').mockRejectedValue(new Error('Database timeout'));

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

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(state);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);

      const result = await completeMigration(context, state);

      expect(result.error).toBeUndefined();
      expect(upsertSpy).toHaveBeenCalledWith(
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

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(null);

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

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(state);
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(
        new Error('Database write error'),
      );

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

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(state);
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue(undefined);

      const result = await failMigration(context, state, 'Test error');

      expect(result.error).toBeUndefined();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
        }),
      );
    });
  });

  describe('deleteAllTrusteesAndAppointments', () => {
    test('should delete all trustees, appointments, and professional IDs successfully', async () => {
      const deletedTrustees = 42;
      const deletedAppointments = 156;
      const deletedProfessionalIds = 17;

      const deleteAllSpy = vi
        .spyOn(MockMongoRepository.prototype, 'deleteAll')
        .mockResolvedValueOnce(deletedTrustees)
        .mockResolvedValueOnce(deletedAppointments)
        .mockResolvedValueOnce(deletedProfessionalIds);

      const result = await deleteAllTrusteesAndAppointments(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.deletedTrustees).toBe(deletedTrustees);
      expect(result.data?.deletedAppointments).toBe(deletedAppointments);
      expect(result.data?.deletedProfessionalIds).toBe(deletedProfessionalIds);
      expect(deleteAllSpy).toHaveBeenCalledTimes(3);
    });

    test('should handle error when deleting trustees fails', async () => {
      const error = new Error('Database error while deleting trustees');
      const deleteAllSpy = vi
        .spyOn(MockMongoRepository.prototype, 'deleteAll')
        .mockRejectedValue(error);

      const result = await deleteAllTrusteesAndAppointments(context);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to delete all trustees and appointments');
      expect(result.data).toBeUndefined();
      expect(deleteAllSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle error when deleting appointments fails', async () => {
      const deletedTrustees = 42;
      const error = new Error('Database error while deleting appointments');
      const deleteAllSpy = vi
        .spyOn(MockMongoRepository.prototype, 'deleteAll')
        .mockResolvedValueOnce(deletedTrustees)
        .mockRejectedValueOnce(error);

      const result = await deleteAllTrusteesAndAppointments(context);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to delete all trustees and appointments');
      expect(result.data).toBeUndefined();
      expect(deleteAllSpy).toHaveBeenCalledTimes(2);
    });

    test('should handle error when deleting professional IDs fails', async () => {
      const deletedTrustees = 42;
      const deletedAppointments = 156;
      const error = new Error('Database error while deleting professional IDs');
      const deleteAllSpy = vi
        .spyOn(MockMongoRepository.prototype, 'deleteAll')
        .mockResolvedValueOnce(deletedTrustees)
        .mockResolvedValueOnce(deletedAppointments)
        .mockRejectedValueOnce(error);

      const result = await deleteAllTrusteesAndAppointments(context);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to delete all trustees and appointments');
      expect(result.data).toBeUndefined();
      expect(deleteAllSpy).toHaveBeenCalledTimes(3);
    });
  });
});
