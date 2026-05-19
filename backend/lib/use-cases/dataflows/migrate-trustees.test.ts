import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  getPageOfTrustees,
  upsertTrustee,
  createAppointments,
  processPageOfTrustees,
  getTotalTrusteeCount,
  deleteAllTrusteesAndAppointments,
  mergeTrusteeRecords,
  upsertProfessionalIds,
  buildDistrictToDivisionsMap,
  detectAmbiguousFlagTrustees,
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
import { AtsTrusteeRecord, FailedAppointment } from '../../adapters/types/ats.types';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { AcmsGateway, AtsGateway, ObjectStorageGateway } from '../../use-cases/gateways.types';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { UstpOfficeDetails } from '@common/cams/offices';

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
        firstName: 'John',
        lastName: 'Doe',
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
      firstName: 'Test',
      lastName: 'Trustee',
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

    test.each([
      ['', 'Smith', 'CA'],
      ['Jane', '', 'CA'],
      ['Jane', 'Smith', ''],
    ])(
      'should return 0 without querying ACMS when name/state is empty ("%s", "%s", "%s")',
      async (firstName, lastName, state) => {
        const acmsSpy = vi.spyOn(factory, 'getAcmsGateway');

        const count = await upsertProfessionalIds(context, 'trustee-x', firstName, lastName, state);

        expect(count).toBe(0);
        expect(acmsSpy).not.toHaveBeenCalled();
      },
    );

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

  describe('processTrusteeWithAppointments - Error Handling', () => {
    const mockTrustee = {
      id: 'doc-id',
      trusteeId: 'trustee-100',
      firstName: 'Test',
      lastName: 'Trustee',
      name: 'Test Trustee',
      status: 'active' as const,
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' as const },
      },
      createdOn: '2023-01-01',
      updatedOn: '2023-01-01',
      updatedBy: { id: 'SYSTEM', name: 'System' },
    };

    beforeEach(() => {
      // Mock offices gateway for all tests
      const mockOfficesGateway = {
        getOffices: vi.fn().mockResolvedValue([]),
        getOfficeName: vi.fn().mockReturnValue(''),
      };
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue(mockOfficesGateway);

      // Stub ACMS gateway to prevent network calls
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getTrusteeProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);
    });

    test('should return error when trustee record is malformed (missing ID)', async () => {
      const malformedTrustee: AtsTrusteeRecord = {
        ID: undefined as unknown as number, // Force undefined ID
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      const trustees = [malformedTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(0); // Merge failed, so not processed
      expect(result.data?.errors).toBe(1);
      expect(result.data?.appointments).toBe(0);
    });

    test('should fail when upsert trustee fails and not process appointments', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Simulate database error during trustee upsert
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockRejectedValue(
        new Error('Database connection lost'),
      );

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(0); // Failed, so not counted as processed
      expect(result.data?.errors).toBe(1);
      expect(result.data?.appointments).toBe(0);
    });

    test('should succeed with trustee saved even when appointment creation fails', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Trustee upsert succeeds
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(mockTrustee);

      // Appointments fetch succeeds
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

      // Appointment creation fails
      vi.spyOn(MockMongoRepository.prototype, 'createAppointment').mockRejectedValue(
        new Error('Database write failed'),
      );

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      // Trustee succeeded, so success count = 1
      expect(result.data?.processed).toBe(1);
      expect(result.data?.errors).toBe(0);
      // But appointments failed
      expect(result.data?.appointments).toBe(0);
    });

    test('should continue when appointment fetch fails for one TOD ID but succeed for trustee', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Trustee upsert succeeds
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(mockTrustee);

      // Appointment fetch fails (ATS timeout, network error, etc.)
      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockRejectedValue(
        new Error('ATS gateway timeout'),
      );

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      // Trustee is saved successfully despite appointment fetch failure
      expect(result.data?.processed).toBe(1);
      expect(result.data?.errors).toBe(0);
      expect(result.data?.appointments).toBe(0);
    });

    test('should continue when professional ID lookup fails', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Trustee upsert succeeds
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(mockTrustee);

      // Appointments succeed with no appointments
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

      // ACMS lookup fails
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getTrusteeProfessionalIds: vi.fn().mockRejectedValue(new Error('ACMS service down')),
      } as unknown as AcmsGateway);

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      // Trustee succeeded despite ACMS failure (non-fatal)
      expect(result.data?.processed).toBe(1);
      expect(result.data?.errors).toBe(0);
    });

    test('should handle trustee with no appointments successfully', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Trustee upsert succeeds
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(mockTrustee);

      // No appointments returned
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

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(1);
      expect(result.data?.errors).toBe(0);
      expect(result.data?.appointments).toBe(0);
    });

    test('should process multiple trustees with mixed success and failures', async () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' }, // Will succeed
        { ID: 2, FIRST_NAME: 'Jane', LAST_NAME: 'Smith', STATE: 'CA' }, // Will fail on upsert
        { ID: 3, FIRST_NAME: 'Bob', LAST_NAME: 'Jones', STATE: 'TX' }, // Will succeed
      ];

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState')
        .mockResolvedValueOnce(null) // John - not found, create new
        .mockRejectedValueOnce(new Error('Database error')) // Jane - fails
        .mockResolvedValueOnce(null); // Bob - not found, create new

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(mockTrustee);

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

      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(2); // John and Bob succeeded
      expect(result.data?.errors).toBe(1); // Only Jane failed
    });

    test('should track failed appointments from ATS gateway', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Trustee upsert succeeds
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(mockTrustee);

      // ATS returns some clean and some failed appointments
      const failedAppointments: FailedAppointment[] = [
        {
          atsAppointment: {
            TRU_ID: 1,
            DISTRICT: '053N',
            STATE: 'NY',
            CHAPTER: '99',
            STATUS: 'A',
            DATE_APPOINTED: new Date('2023-01-15'),
            EFFECTIVE_DATE: new Date('2023-01-15'),
          },
          classification: 'PROBLEMATIC',
          notes: ['Invalid court ID'],
          mapType: 'DISTRICT_CHAPTER_TYPE',
          timestamp: '2023-01-15T00:00:00.000Z',
        },
      ];

      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockResolvedValue({
        cleanAppointments: [],
        failedAppointments,
        stats: {
          total: 1,
          clean: 0,
          autoRecoverable: 0,
          problematic: 1,
          uncleansable: 0,
          skipped: 0,
        },
      });

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(1);
      expect(result.data?.errors).toBe(0);
      expect(result.data?.failedAppointments).toHaveLength(1);
      expect(result.data?.failedAppointments?.[0].notes).toContain('Invalid court ID');
    });

    test('should return error when getOffices fails and not process any trustees', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Simulate DXTR offices gateway failure
      const mockOfficesGateway = {
        getOffices: vi.fn().mockRejectedValue(new Error('DXTR service unavailable')),
        getOfficeName: vi.fn().mockReturnValue(''),
      };
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue(mockOfficesGateway);

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      // Should return error, not process any trustees
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Failed to fetch DXTR office data');
      expect(result.data).toBeUndefined();
    });
  });

  describe('processTrusteeWithRetry - Retry Logic', () => {
    const mockTrustee = {
      id: 'doc-id',
      trusteeId: 'trustee-100',
      firstName: 'Test',
      lastName: 'Trustee',
      name: 'Test Trustee',
      status: 'active' as const,
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' as const },
      },
      createdOn: '2023-01-01',
      updatedOn: '2023-01-01',
      updatedBy: { id: 'SYSTEM', name: 'System' },
    };

    beforeEach(() => {
      // Mock offices gateway for all tests
      const mockOfficesGateway = {
        getOffices: vi.fn().mockResolvedValue([]),
        getOfficeName: vi.fn().mockReturnValue(''),
      };
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue(mockOfficesGateway);

      // Stub ACMS gateway
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getTrusteeProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);

      // Stub appointments
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
    });

    test('should succeed on first attempt without retrying', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Trustee upsert succeeds immediately
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrustee')
        .mockResolvedValue(mockTrustee);

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(1);
      expect(result.data?.errors).toBe(0);
      expect(createSpy).toHaveBeenCalledTimes(1); // Success on first attempt, no retries
    });

    test('should retry and succeed on second attempt', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Fail on first attempt, succeed on second
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState')
        .mockRejectedValueOnce(new Error('Transient database error'))
        .mockResolvedValueOnce(null);

      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrustee')
        .mockResolvedValue(mockTrustee);

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(1); // Eventually succeeded
      expect(result.data?.errors).toBe(0);
      expect(createSpy).toHaveBeenCalledTimes(1); // Called once after successful retry
    });

    test('should retry twice and succeed on third attempt', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Fail twice, succeed on third attempt (MAX_RETRY_ATTEMPTS = 2)
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState')
        .mockRejectedValueOnce(new Error('Transient error 1'))
        .mockRejectedValueOnce(new Error('Transient error 2'))
        .mockResolvedValueOnce(null);

      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createTrustee')
        .mockResolvedValue(mockTrustee);

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(1); // Eventually succeeded
      expect(result.data?.errors).toBe(0);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    test('should fail after exhausting all retry attempts', async () => {
      const atsTrustee: AtsTrusteeRecord = {
        ID: 1,
        FIRST_NAME: 'John',
        LAST_NAME: 'Doe',
        STATE: 'NY',
      };

      // Fail on all attempts
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockRejectedValue(
        new Error('Persistent database error'),
      );

      const trustees = [atsTrustee];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(0); // Failed after all retries
      expect(result.data?.errors).toBe(1);
    }, 10000); // 10 second timeout for retry delays (1s + 2s)

    test('should retry each failed trustee independently', async () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' }, // Will fail then succeed
        { ID: 2, FIRST_NAME: 'Jane', LAST_NAME: 'Smith', STATE: 'CA' }, // Will succeed immediately
        { ID: 3, FIRST_NAME: 'Bob', LAST_NAME: 'Jones', STATE: 'TX' }, // Will fail permanently
      ];

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState')
        .mockRejectedValueOnce(new Error('John fails first'))
        .mockResolvedValueOnce(null) // John succeeds on retry
        .mockResolvedValueOnce(null) // Jane succeeds immediately
        .mockRejectedValue(new Error('Bob fails permanently')); // Bob fails all attempts

      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(mockTrustee);

      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(2); // John and Jane succeeded
      expect(result.data?.errors).toBe(1); // Only Bob failed permanently
    }, 15000); // 15 second timeout for retry delays
  });

  describe('processPageOfTrustees', () => {
    test('should process multiple trustees', async () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' },
        { ID: 2, FIRST_NAME: 'Jane', LAST_NAME: 'Smith', STATE: 'CA' },
      ];

      // Mock offices gateway for district-to-divisions mapping
      const mockOfficesGateway = {
        getOffices: vi.fn().mockResolvedValue([]),
        getOfficeName: vi.fn().mockReturnValue(''),
      };
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue(mockOfficesGateway);

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

      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(2);
      expect(result.data?.errors).toBe(0);
    });

    test('should enrich district appointments with all division codes', async () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' },
      ];

      // Mock offices with divisions for district 081
      const mockOffices: UstpOfficeDetails[] = [
        {
          officeCode: 'USTP_REGION_02_MANHATTAN',
          officeName: 'Manhattan',
          idpGroupName: 'USTP REGION 02 MANHATTAN',
          regionId: '2',
          regionName: 'New York',
          groups: [
            {
              groupDesignator: 'MN',
              divisions: [
                {
                  divisionCode: 'MAH',
                  court: {
                    courtId: '081',
                    courtName:
                      'United States Bankruptcy Court for the Southern District of New York',
                    state: 'NY',
                  },
                  courtOffice: {
                    courtOfficeCode: 'MAH',
                    courtOfficeName: 'Manhattan Office',
                  },
                },
                {
                  divisionCode: 'MAN',
                  court: {
                    courtId: '081',
                    courtName:
                      'United States Bankruptcy Court for the Southern District of New York',
                    state: 'NY',
                  },
                  courtOffice: {
                    courtOfficeCode: 'MAN',
                    courtOfficeName: 'Poughkeepsie Office',
                  },
                },
              ],
            },
          ],
        },
      ];

      const mockOfficesGateway = {
        getOffices: vi.fn().mockResolvedValue(mockOffices),
        getOfficeName: vi.fn().mockReturnValue(''),
      };
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue(mockOfficesGateway);

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue({
        id: 'new-id',
        trusteeId: 'trustee-123',
        name: 'Test',
      });

      // Mock an appointment for district 081 (no divisionCode yet)
      const districtAppointment: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '081',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-20',
      };

      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockResolvedValue({
        cleanAppointments: [districtAppointment],
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

      const createAppointmentSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createAppointment')
        .mockResolvedValue({
          id: 'appt-1',
          trusteeId: 'trustee-123',
        });

      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockResolvedValue([]);

      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(1);
      expect(result.data?.errors).toBe(0);

      // Should have created 1 appointment (district-level, with all division codes)
      expect(createAppointmentSpy).toHaveBeenCalledTimes(1);

      // Check that the single appointment has all division codes
      const call = createAppointmentSpy.mock.calls[0];
      const appointment = call[1];
      expect(appointment.divisionCodes).toEqual(expect.arrayContaining(['MAH', 'MAN']));
      expect(appointment.divisionCodes).toHaveLength(2);
      expect(appointment.divisionCode).toBeUndefined();

      // Check that the appointment has the court name from the first division
      expect(appointment.courtName).toBe(
        'United States Bankruptcy Court for the Southern District of New York',
      );
    });

    test('should keep appointment unchanged when no divisions found', async () => {
      const trustees: AtsTrusteeRecord[] = [
        { ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' },
      ];

      // Mock empty offices (no divisions)
      const mockOfficesGateway = {
        getOffices: vi.fn().mockResolvedValue([]),
        getOfficeName: vi.fn().mockReturnValue(''),
      };
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue(mockOfficesGateway);

      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue({
        id: 'new-id',
        trusteeId: 'trustee-123',
        name: 'Test',
      });

      // Mock an appointment for district 999 (no divisions available)
      const appointmentWithoutDivisions: TrusteeAppointmentInput = {
        chapter: '7',
        appointmentType: 'panel',
        courtId: '999',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-20',
      };

      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockResolvedValue({
        cleanAppointments: [appointmentWithoutDivisions],
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

      const createAppointmentSpy = vi
        .spyOn(MockMongoRepository.prototype, 'createAppointment')
        .mockResolvedValue({
          id: 'appt-1',
          trusteeId: 'trustee-123',
        });

      vi.spyOn(MockMongoRepository.prototype, 'getTrusteeAppointments').mockResolvedValue([]);

      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(1);
      expect(result.data?.errors).toBe(0);

      // Should have created 1 appointment (no expansion)
      expect(createAppointmentSpy).toHaveBeenCalledTimes(1);

      // Check that appointment has no division code (second argument is the appointment)
      const call = createAppointmentSpy.mock.calls[0];
      expect(call[1].divisionCode).toBeUndefined();
      expect(call[1].courtId).toBe('999');
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

  describe('writeFailedAppointments (via processPageOfTrustees)', () => {
    const mockTrustee = {
      id: 'doc-id',
      trusteeId: 'trustee-100',
      firstName: 'Test',
      lastName: 'Trustee',
      name: 'Test Trustee',
      status: 'active' as const,
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' as const },
      },
      createdOn: '2023-01-01',
      updatedOn: '2023-01-01',
      updatedBy: { id: 'SYSTEM', name: 'System' },
    };

    const failedAppointments: FailedAppointment[] = [
      {
        atsAppointment: {
          TRU_ID: 1,
          DISTRICT: '053N',
          STATE: 'NY',
          CHAPTER: '99',
          STATUS: 'A',
          DATE_APPOINTED: new Date('2023-01-15'),
          EFFECTIVE_DATE: new Date('2023-01-15'),
        },
        classification: 'PROBLEMATIC',
        notes: ['Invalid court ID'],
        mapType: 'DISTRICT_CHAPTER_TYPE',
        timestamp: '2023-01-15T00:00:00.000Z',
      },
    ];

    beforeEach(() => {
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        getOffices: vi.fn().mockResolvedValue([]),
        getOfficeName: vi.fn().mockReturnValue(''),
      });
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getTrusteeProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(mockTrustee);
      vi.spyOn(atsGateway, 'getTrusteeAppointments').mockResolvedValue({
        cleanAppointments: [],
        failedAppointments,
        stats: {
          total: 1,
          clean: 0,
          autoRecoverable: 0,
          problematic: 1,
          uncleansable: 0,
          skipped: 0,
        },
      });
    });

    test('should write failed appointments to blob storage when they exist', async () => {
      const mockObjectStorage: ObjectStorageGateway = {
        readObject: vi.fn(),
        writeObject: vi.fn().mockResolvedValue(undefined),
      };
      vi.spyOn(factory, 'getObjectStorageGateway').mockReturnValue(mockObjectStorage);

      const trustees = [{ ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' }];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(result.data?.processed).toBe(1);
      expect(result.data?.failedAppointments).toHaveLength(1);
      expect(mockObjectStorage.writeObject).toHaveBeenCalledWith(
        'migrate-trustees-out',
        expect.stringMatching(/^failed-appointments-.*\.jsonl$/),
        expect.stringContaining('"classification":"PROBLEMATIC"'),
      );
    });

    test('should continue and not throw when blob write fails', async () => {
      const mockObjectStorage: ObjectStorageGateway = {
        readObject: vi.fn(),
        writeObject: vi.fn().mockRejectedValue(new Error('Blob storage unavailable')),
      };
      vi.spyOn(factory, 'getObjectStorageGateway').mockReturnValue(mockObjectStorage);

      const trustees = [{ ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' }];
      const result = await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      // Migration result is unaffected by blob write failure
      expect(result.data?.processed).toBe(1);
      expect(result.data?.errors).toBe(0);
      expect(result.data?.failedAppointments).toHaveLength(1);
      expect(mockObjectStorage.writeObject).toHaveBeenCalled();
    });

    test('should not call writeObject when there are no failed appointments', async () => {
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

      const mockObjectStorage: ObjectStorageGateway = {
        readObject: vi.fn(),
        writeObject: vi.fn(),
      };
      vi.spyOn(factory, 'getObjectStorageGateway').mockReturnValue(mockObjectStorage);

      const trustees = [{ ID: 1, FIRST_NAME: 'John', LAST_NAME: 'Doe', STATE: 'NY' }];
      await processPageOfTrustees(context, trustees, 'migrate-trustees-out');

      expect(mockObjectStorage.writeObject).not.toHaveBeenCalled();
    });
  });

  describe('buildDistrictToDivisionsMap', () => {
    const mockOffices: UstpOfficeDetails[] = [
      {
        officeCode: 'USTP_REGION_02_MANHATTAN',
        officeName: 'Manhattan',
        idpGroupName: 'USTP REGION 02 MANHATTAN',
        regionId: '2',
        regionName: 'New York',
        groups: [
          {
            groupDesignator: 'MN',
            divisions: [
              {
                divisionCode: 'MAH',
                court: {
                  courtId: '081',
                  courtName: 'United States Bankruptcy Court for the Southern District of New York',
                  state: 'NY',
                },
                courtOffice: {
                  courtOfficeCode: 'MAH',
                  courtOfficeName: 'Manhattan Office',
                },
              },
              {
                divisionCode: 'MAN',
                court: {
                  courtId: '081',
                  courtName: 'United States Bankruptcy Court for the Southern District of New York',
                  state: 'NY',
                },
                courtOffice: {
                  courtOfficeCode: 'MAN',
                  courtOfficeName: 'Poughkeepsie Office',
                },
              },
              {
                divisionCode: 'MAW',
                court: {
                  courtId: '081',
                  courtName: 'United States Bankruptcy Court for the Southern District of New York',
                  state: 'NY',
                },
                courtOffice: {
                  courtOfficeCode: 'MAW',
                  courtOfficeName: 'White Plains Office',
                },
              },
            ],
          },
        ],
      },
      {
        officeCode: 'USTP_REGION_03_PHILADELPHIA',
        officeName: 'Philadelphia',
        idpGroupName: 'USTP REGION 03 PHILADELPHIA',
        regionId: '3',
        regionName: 'Pennsylvania',
        groups: [
          {
            groupDesignator: 'PH',
            divisions: [
              {
                divisionCode: 'PAE',
                court: {
                  courtId: '231',
                  courtName:
                    'United States Bankruptcy Court for the Eastern District of Pennsylvania',
                  state: 'PA',
                },
                courtOffice: {
                  courtOfficeCode: 'PAE',
                  courtOfficeName: 'Philadelphia Office',
                },
              },
            ],
          },
        ],
      },
    ];

    test('should map district 081 to all its divisions', () => {
      const districtMap = buildDistrictToDivisionsMap(mockOffices);

      const divisions = districtMap.get('081');
      expect(divisions).toBeDefined();
      expect(divisions).toHaveLength(3);

      const divisionCodes = divisions!.map((d) => d.divisionCode);
      expect(divisionCodes).toContain('MAH');
      expect(divisionCodes).toContain('MAN');
      expect(divisionCodes).toContain('MAW');
    });

    test('should include court information for each division', () => {
      const districtMap = buildDistrictToDivisionsMap(mockOffices);

      const divisions = districtMap.get('081');
      const mahDivision = divisions!.find((d) => d.divisionCode === 'MAH');

      expect(mahDivision).toBeDefined();
      expect(mahDivision!.courtId).toBe('081');
      expect(mahDivision!.courtName).toBe(
        'United States Bankruptcy Court for the Southern District of New York',
      );
      expect(mahDivision!.courtDivisionName).toBe('Manhattan Office');
    });

    test('should map district 231 to its single division', () => {
      const districtMap = buildDistrictToDivisionsMap(mockOffices);

      const divisions = districtMap.get('231');
      expect(divisions).toBeDefined();
      expect(divisions).toHaveLength(1);
      expect(divisions![0].divisionCode).toBe('PAE');
      expect(divisions![0].courtId).toBe('231');
    });

    test('should return empty map for empty offices array', () => {
      const districtMap = buildDistrictToDivisionsMap([]);

      expect(districtMap.size).toBe(0);
    });
  });

  describe('detectAmbiguousFlagTrustees', () => {
    const makeTrustee = (
      id: number,
      dispOnWeb?: string,
      dispOnWebA2?: string,
    ): AtsTrusteeRecord => ({
      ID: id,
      FIRST_NAME: `First${id}`,
      LAST_NAME: `Last${id}`,
      STREET: `${id} Main St`,
      CITY: 'City',
      STATE: 'TX',
      ZIP: '77001',
      STREET_A2: `${id} Alt Ave`,
      CITY_A2: 'AltCity',
      STATE_A2: 'TX',
      ZIP_A2: '77002',
      DISP_ON_WEB: dispOnWeb,
      DISP_ON_WEB_A2: dispOnWebA2,
    });

    test('should detect trustees where both flags are y', () => {
      const trustees = [makeTrustee(1, 'y', 'y'), makeTrustee(2, 'y', 'N')];
      const result = detectAmbiguousFlagTrustees(trustees);
      expect(result).toHaveLength(1);
      expect(result[0].trusteeId).toBe(1);
      expect(result[0].condition).toBe('both-y');
    });

    test('should detect trustees where both flags are N', () => {
      const trustees = [makeTrustee(1, 'N', 'N'), makeTrustee(2, 'y', 'N')];
      const result = detectAmbiguousFlagTrustees(trustees);
      expect(result).toHaveLength(1);
      expect(result[0].trusteeId).toBe(1);
      expect(result[0].condition).toBe('both-n');
    });

    test('should treat flag comparison as case-insensitive', () => {
      const trustees = [makeTrustee(1, 'Y', 'Y'), makeTrustee(2, 'n', 'n')];
      const result = detectAmbiguousFlagTrustees(trustees);
      expect(result).toHaveLength(2);
      expect(result[0].condition).toBe('both-y');
      expect(result[1].condition).toBe('both-n');
    });

    test('should include trustee name and both address sets in result', () => {
      const trustees = [makeTrustee(5, 'y', 'y')];
      const result = detectAmbiguousFlagTrustees(trustees);
      expect(result[0].name).toBe('First5 Last5');
      expect(result[0].address).toMatchObject({ street: '5 Main St', city: 'City' });
      expect(result[0].addressA2).toMatchObject({ street: '5 Alt Ave', city: 'AltCity' });
    });

    test('should return empty array when no ambiguous trustees exist', () => {
      const trustees = [makeTrustee(1, 'y', 'N'), makeTrustee(2, 'N', 'y')];
      const result = detectAmbiguousFlagTrustees(trustees);
      expect(result).toHaveLength(0);
    });

    test('should return empty array when flags are absent', () => {
      const trustees = [makeTrustee(1, undefined, undefined)];
      const result = detectAmbiguousFlagTrustees(trustees);
      expect(result).toHaveLength(0);
    });
  });

  describe('processPageOfTrustees - ambiguous flag JSONL write', () => {
    let objectStorageGateway: ObjectStorageGateway;
    let writeObjectSpy: ReturnType<typeof vi.spyOn>;

    const mockCreatedTrustee = {
      id: 'doc-amb',
      trusteeId: 'trustee-amb',
      firstName: 'Amb',
      lastName: 'Iguous',
      name: 'Amb Iguous',
      status: 'active' as const,
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' as const },
      },
      createdOn: '2023-01-01',
      updatedOn: '2023-01-01',
      updatedBy: { id: 'SYSTEM', name: 'System' },
    };

    beforeEach(() => {
      objectStorageGateway = factory.getObjectStorageGateway(context);
      writeObjectSpy = vi.spyOn(objectStorageGateway, 'writeObject').mockResolvedValue(undefined);
      vi.spyOn(factory, 'getObjectStorageGateway').mockReturnValue(objectStorageGateway);

      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        getOffices: vi.fn().mockResolvedValue([]),
        getOfficeName: vi.fn().mockReturnValue(''),
      });
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getTrusteeProfessionalIds: vi.fn().mockResolvedValue([]),
      } as unknown as AcmsGateway);
      vi.spyOn(MockMongoRepository.prototype, 'findTrusteeByNameAndState').mockResolvedValue(null);
      vi.spyOn(MockMongoRepository.prototype, 'createTrustee').mockResolvedValue(
        mockCreatedTrustee,
      );
    });

    test('should write ambiguous-flag trustees to JSONL when both flags are y', async () => {
      const trustee: AtsTrusteeRecord = {
        ID: 99,
        FIRST_NAME: 'Amb',
        LAST_NAME: 'Iguous',
        STATE: 'TX',
        STREET: '1 Public St',
        CITY: 'City',
        ZIP: '77001',
        STREET_A2: '2 Internal Ave',
        CITY_A2: 'AltCity',
        STATE_A2: 'TX',
        ZIP_A2: '77002',
        DISP_ON_WEB: 'y',
        DISP_ON_WEB_A2: 'y',
      };

      await processPageOfTrustees(context, [trustee], 'migrate-trustees-out');

      const ambiguousCall = writeObjectSpy.mock.calls.find(([, fileName]) =>
        (fileName as string).startsWith('ambiguous-flags-'),
      );
      expect(ambiguousCall).toBeDefined();

      const [, , content] = ambiguousCall!;
      const record = JSON.parse((content as string).split('\n')[0]);
      expect(record.trusteeId).toBe(99);
      expect(record.condition).toBe('both-y');
    });

    test('should write ambiguous-flag trustees to JSONL when both flags are N', async () => {
      const trustee: AtsTrusteeRecord = {
        ID: 100,
        FIRST_NAME: 'Double',
        LAST_NAME: 'No',
        STATE: 'TX',
        STREET: '1 Public St',
        CITY: 'City',
        ZIP: '77001',
        STREET_A2: '2 Internal Ave',
        CITY_A2: 'AltCity',
        STATE_A2: 'TX',
        ZIP_A2: '77002',
        DISP_ON_WEB: 'N',
        DISP_ON_WEB_A2: 'N',
      };

      await processPageOfTrustees(context, [trustee], 'migrate-trustees-out');

      const ambiguousCall = writeObjectSpy.mock.calls.find(([, fileName]) =>
        (fileName as string).startsWith('ambiguous-flags-'),
      );
      expect(ambiguousCall).toBeDefined();
      const [, , content] = ambiguousCall!;
      const record = JSON.parse((content as string).split('\n')[0]);
      expect(record.condition).toBe('both-n');
    });

    test('should not write ambiguous-flags file when no ambiguous trustees exist', async () => {
      const trustee: AtsTrusteeRecord = {
        ID: 101,
        FIRST_NAME: 'Normal',
        LAST_NAME: 'Trustee',
        STATE: 'TX',
        DISP_ON_WEB: 'y',
        DISP_ON_WEB_A2: 'N',
      };

      await processPageOfTrustees(context, [trustee], 'migrate-trustees-out');

      const ambiguousCall = writeObjectSpy.mock.calls.find(([, fileName]) =>
        (fileName as string).startsWith('ambiguous-flags-'),
      );
      expect(ambiguousCall).toBeUndefined();
    });
  });
});
