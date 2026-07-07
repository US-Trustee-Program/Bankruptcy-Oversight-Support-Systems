import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MigrateCaseAppointmentsUseCase, {
  CMMAP_CUTOFF_DATE,
  ResolvedAcmsRecord,
  clearProfessionalIdMapCache,
} from './migrate-case-appointments';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import factory from '../../factory';
import { AcmsCaseAppointmentRawRecord } from '../gateways.types';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { TrusteeProfessionalId } from '@common/cams/trustee-professional-ids';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';

function makeRawRecord(
  override: Partial<AcmsCaseAppointmentRawRecord> = {},
): AcmsCaseAppointmentRawRecord {
  return {
    id: 1001,
    CASE_DIV: 81,
    CASE_YEAR: 24,
    CASE_NUMBER: 12345,
    GROUP_DESIGNATOR: 'NY',
    PROF_CODE: 63,
    APPT_DATE: 20200101,
    DISP_DATE: null,
    CASE_FILED_DATE: 20190110,
    CURR_CASE_CHAPT: '7',
    CLOSED_BY_COURT_DATE: null,
    CLOSED_BY_UST_DATE: null,
    REOPENED_DATE: null,
    ...override,
  };
}

function makeResolvedRecord(override: Partial<ResolvedAcmsRecord> = {}): ResolvedAcmsRecord {
  return {
    id: 1001,
    caseId: '081-24-12345',
    acmsProfessionalId: 'NY-00063',
    assignDate: 20200101,
    apptDate: 20200101,
    unassignDate: null,
    caseFiledDate: 20190110,
    chapter: '7',
    courtDivisionCode: '081',
    closedByCourtDate: null,
    closedByUstDate: null,
    reopenedDate: null,
    trusteeId: 'trustee-001',
    ...override,
  };
}

function makeProfessionalId(override: Partial<TrusteeProfessionalId> = {}): TrusteeProfessionalId {
  return {
    id: 'prof-id-1',
    documentType: 'TRUSTEE_PROFESSIONAL_ID',
    camsTrusteeId: 'trustee-001',
    acmsProfessionalId: 'NY-00063',
    createdOn: '2024-01-01T00:00:00.000Z',
    createdBy: { id: 'system', name: 'System' },
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: { id: 'system', name: 'System' },
    ...override,
  };
}

function setupAcmsGateway(records: AcmsCaseAppointmentRawRecord[]) {
  vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
    getCmmapAppointmentsRaw: vi.fn().mockResolvedValue(records),
  } as never);
}

function setupProfessionalIdsRepo(ids: TrusteeProfessionalId[]) {
  vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
    Object.assign(new MockMongoRepository(), {
      findAll: vi.fn().mockResolvedValue(ids),
    }),
  );
}

describe('MigrateCaseAppointmentsUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearProfessionalIdMapCache();
  });

  describe('readPage', () => {
    test('returns resolved records with trusteeId resolved from map', async () => {
      setupAcmsGateway([makeRawRecord()]);
      setupProfessionalIdsRepo([makeProfessionalId()]);

      const result = await MigrateCaseAppointmentsUseCase.readPage(context, null, 10);

      expect(result.isEmpty).toBe(false);
      expect(result.records).toHaveLength(1);
      expect(result.records[0].caseId).toBe('081-24-12345');
      expect(result.records[0].acmsProfessionalId).toBe('NY-00063');
      expect(result.records[0].trusteeId).toBe('trustee-001');
      expect(result.nextLastId).toBe(1001);
    });

    test('returns trusteeId=null when professional ID has no mapping', async () => {
      setupAcmsGateway([makeRawRecord()]);
      setupProfessionalIdsRepo([]); // empty map

      const result = await MigrateCaseAppointmentsUseCase.readPage(context, null, 10);

      expect(result.records[0].trusteeId).toBeNull();
    });

    test('returns isEmpty=true when ACMS returns no records', async () => {
      setupAcmsGateway([]);
      setupProfessionalIdsRepo([]);

      const result = await MigrateCaseAppointmentsUseCase.readPage(context, null, 10);

      expect(result.isEmpty).toBe(true);
      expect(result.records).toHaveLength(0);
      expect(result.nextLastId).toBeNull();
    });

    test('nextLastId is the id of the last raw record', async () => {
      setupAcmsGateway([makeRawRecord({ id: 100 }), makeRawRecord({ id: 200 })]);
      setupProfessionalIdsRepo([makeProfessionalId()]);

      const result = await MigrateCaseAppointmentsUseCase.readPage(context, null, 10);

      expect(result.nextLastId).toBe(200);
    });

    test('formats caseId correctly from raw component fields', async () => {
      setupAcmsGateway([makeRawRecord({ CASE_DIV: 9, CASE_YEAR: 5, CASE_NUMBER: 99 })]);
      setupProfessionalIdsRepo([makeProfessionalId()]);

      const result = await MigrateCaseAppointmentsUseCase.readPage(context, null, 10);

      expect(result.records[0].caseId).toBe('009-05-00099');
    });

    test('formats acmsProfessionalId correctly from raw component fields', async () => {
      setupAcmsGateway([makeRawRecord({ GROUP_DESIGNATOR: 'CA', PROF_CODE: 7 })]);
      setupProfessionalIdsRepo([makeProfessionalId({ acmsProfessionalId: 'CA-00007' })]);

      const result = await MigrateCaseAppointmentsUseCase.readPage(context, null, 10);

      expect(result.records[0].acmsProfessionalId).toBe('CA-00007');
    });

    test('passes CMMAP_CUTOFF_DATE to getCmmapAppointmentsRaw', async () => {
      const spy = vi.fn().mockResolvedValue([]);
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointmentsRaw: spy,
      } as never);
      setupProfessionalIdsRepo([]);

      await MigrateCaseAppointmentsUseCase.readPage(context, 42, 10);

      expect(spy).toHaveBeenCalledWith(context, 42, 10, CMMAP_CUTOFF_DATE);
    });

    test('throws when getCmmapAppointmentsRaw throws', async () => {
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointmentsRaw: vi.fn().mockRejectedValue(new Error('ACMS unavailable')),
      } as never);

      await expect(MigrateCaseAppointmentsUseCase.readPage(context, null, 10)).rejects.toThrow(
        'ACMS unavailable',
      );
    });
  });

  describe('writePage', () => {
    test('upserts records with trusteeId and returns successCount', async () => {
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      const records = [makeResolvedRecord(), makeResolvedRecord({ id: 1002 })];
      const result = await MigrateCaseAppointmentsUseCase.writePage(context, records);

      expect(result.successCount).toBe(2);
      expect(result.failures).toHaveLength(0);
      expect(result.remaining).toHaveLength(0);
      expect(result.recommendedVisibilitySeconds).toBe(0);
      expect(upsertSpy).toHaveBeenCalledTimes(2);
    });

    test('writes sentinel doc for records with trusteeId=null instead of failing', async () => {
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      const records = [makeResolvedRecord({ trusteeId: null })];
      const result = await MigrateCaseAppointmentsUseCase.writePage(context, records);

      expect(result.successCount).toBe(1);
      expect(result.failures).toHaveLength(0);
      expect(result.remaining).toHaveLength(0);

      const sentinelInput = upsertSpy.mock.calls[0][0];
      expect(sentinelInput.trusteeId).toBe('00000000-0000-0000-0000-000000000000');
      expect(sentinelInput.reason).toBe('trustee-not-found');
      expect(sentinelInput.acmsProfessionalId).toBeDefined();
    });

    test('returns failure when upsert throws, continues remaining records', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert')
        .mockRejectedValueOnce(new Error('cosmos error'))
        .mockResolvedValue({} as CaseAppointment);

      const records = [makeResolvedRecord(), makeResolvedRecord({ id: 1002 })];
      const result = await MigrateCaseAppointmentsUseCase.writePage(context, records);

      expect(result.successCount).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].reason).toContain('cosmos error');
      expect(result.remaining).toHaveLength(0);
      expect(result.recommendedVisibilitySeconds).toBe(0);
    });

    test('returns failure for invalid date formats', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({} as CaseAppointment);

      const records = [makeResolvedRecord({ assignDate: 202 })];
      const result = await MigrateCaseAppointmentsUseCase.writePage(context, records);

      expect(result.successCount).toBe(0);
      expect(result.failures[0].reason).toContain('Invalid');
      expect(result.remaining).toHaveLength(0);
      expect(result.recommendedVisibilitySeconds).toBe(0);
    });

    test('upsert called with correct caseId, trusteeId, assignedOn', async () => {
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      await MigrateCaseAppointmentsUseCase.writePage(context, [
        makeResolvedRecord({ assignDate: 20200615, apptDate: 20200620 }),
      ]);

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: '081-24-12345',
          trusteeId: 'trustee-001',
          assignedOn: '2020-06-15',
          appointedDate: '2020-06-20',
          source: 'acms',
        }),
      );
    });

    test('omits appointedDate when apptDate is null', async () => {
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      await MigrateCaseAppointmentsUseCase.writePage(context, [
        makeResolvedRecord({ apptDate: null }),
      ]);

      expect(upsertSpy.mock.calls[0][0]).not.toHaveProperty('appointedDate');
    });

    test('omits unassignedOn when unassignDate is null', async () => {
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      await MigrateCaseAppointmentsUseCase.writePage(context, [
        makeResolvedRecord({ unassignDate: null }),
      ]);

      expect(upsertSpy.mock.calls[0][0]).not.toHaveProperty('unassignedOn');
    });
  });

  describe('writePage — serial backoff and escape hatch', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    test('all records succeed serially', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({} as CaseAppointment);
      const records = [
        makeResolvedRecord(),
        makeResolvedRecord({ id: 1002 }),
        makeResolvedRecord({ id: 1003 }),
      ];
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        safeThresholdMs: 58 * 60 * 1000,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.successCount).toBe(3);
      expect(result.failures).toHaveLength(0);
      expect(result.remaining).toHaveLength(0);
      expect(result.recommendedVisibilitySeconds).toBe(0);
    });

    test('non-429 error goes to failures, loop continues', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert')
        .mockRejectedValueOnce(new Error('cosmos write error'))
        .mockResolvedValue({} as CaseAppointment);
      const records = [makeResolvedRecord(), makeResolvedRecord({ id: 1002 })];
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        safeThresholdMs: 58 * 60 * 1000,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.successCount).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].reason).toContain('cosmos write error');
      expect(result.remaining).toHaveLength(0);
    });

    test('429 retries then succeeds', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert')
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockResolvedValue({} as CaseAppointment);
      const records = [makeResolvedRecord()];
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        safeThresholdMs: 58 * 60 * 1000,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.successCount).toBe(1);
      expect(result.failures).toHaveLength(0);
      expect(result.remaining).toHaveLength(0);
    });

    test('escape hatch fires when next backoff would exceed safeThresholdMs', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(
        new TooManyRequestsError('TEST'),
      );
      const records = [makeResolvedRecord(), makeResolvedRecord({ id: 1002 })];
      // startedAt set so elapsed + first backoff (200ms = 2^1 * 100) exceeds safeThresholdMs (150ms)
      const startedAt = Date.now() - 100;
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        startedAt,
        safeThresholdMs: 150,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.remaining).toHaveLength(2);
      expect(result.successCount).toBe(0);
      expect(result.recommendedVisibilitySeconds).toBeGreaterThan(0);
    });

    test('escape fires immediately when already past threshold on first 429', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(
        new TooManyRequestsError('TEST'),
      );
      const records = [
        makeResolvedRecord(),
        makeResolvedRecord({ id: 1002 }),
        makeResolvedRecord({ id: 1003 }),
      ];
      // startedAt far in the past so any backoff exceeds threshold
      const startedAt = Date.now() - 10_000;
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        startedAt,
        safeThresholdMs: 1,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.remaining).toHaveLength(3);
      expect(result.successCount).toBe(0);
    });

    test('multiple 429 retries before success when threshold is generous', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert')
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockResolvedValue({} as CaseAppointment);
      const records = [makeResolvedRecord()];
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        safeThresholdMs: 100 * 60 * 1000, // very generous threshold
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.successCount).toBe(1);
      expect(result.remaining).toHaveLength(0);
    });

    test('mixed batch: some succeed, escape fires mid-batch', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValueOnce({} as CaseAppointment)
        .mockResolvedValueOnce({} as CaseAppointment)
        .mockRejectedValue(new TooManyRequestsError('TEST'));
      const records = Array.from({ length: 5 }, (_, i) => makeResolvedRecord({ id: 1001 + i }));
      const startedAt = Date.now() - 100;
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        startedAt,
        safeThresholdMs: 150,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.successCount).toBe(2);
      expect(result.remaining).toHaveLength(3);
      expect(result.remaining[0].id).toBe(1003);
    });

    test('resolves successfully after multiple 429 retries when threshold is not exceeded', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert')
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockResolvedValue({} as CaseAppointment);
      const records = [makeResolvedRecord()];
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        safeThresholdMs: 100 * 60 * 1000,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.successCount).toBe(1);
      expect(result.failures).toHaveLength(0);
      expect(result.remaining).toHaveLength(0);
    });

    test('trusteeId null writes sentinel doc with exponential backoff on 429', async () => {
      const upsertSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockResolvedValue({} as CaseAppointment);
      const records = [makeResolvedRecord({ trusteeId: null })];
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        safeThresholdMs: 58 * 60 * 1000,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.successCount).toBe(1);
      expect(result.failures).toHaveLength(0);
      expect(upsertSpy).toHaveBeenCalledTimes(2);
      const sentinelInput = upsertSpy.mock.calls[1][0];
      expect(sentinelInput.trusteeId).toBe('00000000-0000-0000-0000-000000000000');
      expect(sentinelInput.reason).toBe('trustee-not-found');
      expect(result.remaining).toHaveLength(0);
    });
  });

  describe('updateMigrationState', () => {
    test('re-reads state from repo when existingState arg is omitted and preserves counters', async () => {
      const upsertSpy = vi.fn().mockResolvedValue({});
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockResolvedValue({
            id: 'state-1',
            documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
            lastId: 50,
            processedCount: 50,
            failedCount: 0,
            reEnqueuedCount: 0,
            acmsQueryRetries: 0,
            resumeAttempts: 0,
            readingCompleted: false,
            status: 'IN_PROGRESS',
            startedAt: '2025-01-01T00:00:00Z',
            lastUpdatedAt: '2025-01-02T00:00:00Z',
          }),
          upsert: upsertSpy,
        }) as never,
      );

      await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
        lastId: 100,
        status: 'IN_PROGRESS',
      });

      // processedCount preserved from stateBase (50), not overwritten
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ lastId: 100, processedCount: 50 }),
      );
    });

    test('uses fallback null state when repo.read throws NotFoundError', async () => {
      const upsertSpy = vi.fn().mockResolvedValue({});
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockRejectedValue(new NotFoundError('test')),
          upsert: upsertSpy,
        }) as never,
      );

      await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
        lastId: null,
        status: 'IN_PROGRESS',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'IN_PROGRESS', lastId: null }),
      );
    });

    test('zeros all counters when resetCounters is true', async () => {
      const upsertSpy = vi.fn().mockResolvedValue({});
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockResolvedValue({
            id: 'state-1',
            documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
            lastId: 500,
            processedCount: 5000,
            failedCount: 10,
            reEnqueuedCount: 5,
            acmsQueryRetries: 2,
            resumeAttempts: 1,
            readingCompleted: false,
            status: 'FAILED',
            startedAt: '2025-01-01T00:00:00Z',
            lastUpdatedAt: '2025-01-02T00:00:00Z',
          }),
          upsert: upsertSpy,
        }) as never,
      );

      await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
        lastId: null,
        resetCounters: true,
        readingCompleted: false,
        status: 'IN_PROGRESS',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          processedCount: 0,
          failedCount: 0,
          acmsQueryRetries: 0,
          resumeAttempts: 0,
          readingCompleted: false,
        }),
      );
    });

    test('preserves counters from stateBase when resetCounters is not set', async () => {
      const upsertSpy = vi.fn().mockResolvedValue({});
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockResolvedValue({
            id: 'state-1',
            documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
            lastId: 500,
            processedCount: 5000,
            failedCount: 10,
            reEnqueuedCount: 3,
            acmsQueryRetries: 2,
            resumeAttempts: 1,
            readingCompleted: false,
            status: 'IN_PROGRESS',
            startedAt: '2025-01-01T00:00:00Z',
            lastUpdatedAt: '2025-01-02T00:00:00Z',
          }),
          upsert: upsertSpy,
        }) as never,
      );

      await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
        lastId: 600,
        readingCompleted: false,
        status: 'IN_PROGRESS',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          processedCount: 5000,
          failedCount: 10,
          acmsQueryRetries: 2,
          resumeAttempts: 1,
        }),
      );
    });
  });

  describe('readMigrationState', () => {
    test('returns state when doc exists', async () => {
      const stateDoc = {
        id: 'state-1',
        documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE' as const,
        lastId: 100,
        processedCount: 50,
        failedCount: 0,
        reEnqueuedCount: 0,
        acmsQueryRetries: 0,
        resumeAttempts: 0,
        readingCompleted: false,
        startedAt: '2025-01-01T00:00:00Z',
        lastUpdatedAt: '2025-01-02T00:00:00Z',
        status: 'IN_PROGRESS' as const,
      };
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockResolvedValue(stateDoc),
        }) as never,
      );

      const result = await MigrateCaseAppointmentsUseCase.readMigrationState(context);

      expect(result.data).toEqual(stateDoc);
      expect(result.error).toBeUndefined();
    });

    test('returns { data: null } when state doc does not exist', async () => {
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockRejectedValue(new NotFoundError('test')),
        }) as never,
      );

      const result = await MigrateCaseAppointmentsUseCase.readMigrationState(context);

      expect(result.data).toBeNull();
      expect(result.error).toBeUndefined();
    });

    test('returns error when repo throws a non-NotFound error', async () => {
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockRejectedValue(new Error('cosmos unavailable')),
        }) as never,
      );

      const result = await MigrateCaseAppointmentsUseCase.readMigrationState(context);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('incrementMetric', () => {
    test('calls atomicIncrement with the correct field and amount', async () => {
      const atomicIncrementSpy = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          atomicIncrement: atomicIncrementSpy,
        }) as never,
      );

      await MigrateCaseAppointmentsUseCase.incrementMetric(context, 'processedCount', 5);

      expect(atomicIncrementSpy).toHaveBeenCalledWith(
        'MIGRATE_CASE_APPOINTMENTS_STATE',
        'processedCount',
        5,
      );
    });

    test('swallows repo errors and does not throw', async () => {
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          atomicIncrement: vi.fn().mockRejectedValue(new Error('cosmos throttled')),
        }) as never,
      );

      await expect(
        MigrateCaseAppointmentsUseCase.incrementMetric(context, 'failedCount', 1),
      ).resolves.toBeUndefined();
    });
  });

  describe('reindexPhase', () => {
    function setupRepo(overrides: Record<string, unknown> = {}) {
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), overrides) as never,
      );
    }

    test('returns needs-polling when new compound index not present and no build in progress', async () => {
      setupRepo({
        checkIndexExists: vi
          .fn()
          .mockResolvedValueOnce(false) // new index absent
          .mockResolvedValueOnce(false), // old index absent too (for this check)
        createCompoundIndex: vi.fn().mockResolvedValue(undefined),
      });

      const result = await MigrateCaseAppointmentsUseCase.reindexPhase(context);

      expect(result.status).toBe('needs-polling');
    });

    test('calls createCompoundIndex when new index is absent', async () => {
      const createSpy = vi.fn().mockResolvedValue(undefined);
      setupRepo({
        checkIndexExists: vi.fn().mockResolvedValue(false),
        createCompoundIndex: createSpy,
      });

      await MigrateCaseAppointmentsUseCase.reindexPhase(context);

      expect(createSpy).toHaveBeenCalled();
    });

    test('returns needs-polling without calling createCompoundIndex when build is in progress', async () => {
      // When first call is false but index build is in progress (detected by IndexNotFound or similar),
      // the use case just re-polls. Simulate: createCompoundIndex throws "build in progress" error.
      const createSpy = vi.fn().mockRejectedValue(new Error('index build in progress'));
      setupRepo({
        checkIndexExists: vi.fn().mockResolvedValue(false),
        createCompoundIndex: createSpy,
      });

      const result = await MigrateCaseAppointmentsUseCase.reindexPhase(context);

      // Even if createCompoundIndex throws "in progress", we still need-polling
      expect(result.status).toBe('needs-polling');
    });

    test('drops old index and returns ready when new index present and old index still exists', async () => {
      const dropSpy = vi.fn().mockResolvedValue(undefined);
      setupRepo({
        checkIndexExists: vi
          .fn()
          .mockResolvedValueOnce(true) // new index present
          .mockResolvedValueOnce(true), // old index still present
        dropIndex: dropSpy,
      });

      const result = await MigrateCaseAppointmentsUseCase.reindexPhase(context);

      expect(dropSpy).toHaveBeenCalledWith('trusteeId_1_unassignedOn_1');
      expect(result.status).toBe('ready');
    });

    test('returns ready immediately when new index present and old index already gone', async () => {
      const dropSpy = vi.fn().mockResolvedValue(undefined);
      setupRepo({
        checkIndexExists: vi
          .fn()
          .mockResolvedValueOnce(true) // new index present
          .mockResolvedValueOnce(false), // old index already gone
        dropIndex: dropSpy,
      });

      const result = await MigrateCaseAppointmentsUseCase.reindexPhase(context);

      expect(dropSpy).not.toHaveBeenCalled();
      expect(result.status).toBe('ready');
    });
  });

  describe('heal', () => {
    test('upserts docs missing from trustee partition and logs legacy count', async () => {
      const activeCase: CaseAppointment & { _id: string } = {
        _id: 'id1',
        id: 'id1',
        caseId: '081-24-12345',
        trusteeId: 'T1',
        assignedOn: '2020-01-15',
        source: 'acms',
        createdOn: '2020-01-15T00:00:00Z',
        updatedOn: '2020-01-15T00:00:00Z',
        createdBy: { id: 'system', name: 'system' },
        updatedBy: { id: 'system', name: 'system' },
      };

      const upsertSpy = vi.fn().mockResolvedValue(activeCase);

      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          getAllCaseAppointments: vi.fn().mockResolvedValueOnce([activeCase]).mockResolvedValue([]),
          getActiveByTrusteeIdFromTrusteePartition: vi.fn().mockResolvedValue([]), // missing from trustee partition
          upsert: upsertSpy,
          countActiveMissingDateFiled: vi.fn().mockResolvedValue(0),
        }) as never,
      );

      await MigrateCaseAppointmentsUseCase.heal(context);

      expect(upsertSpy).toHaveBeenCalledTimes(1);
    });

    test('skips upsert when doc already exists in trustee partition', async () => {
      const activeCase: CaseAppointment & { _id: string } = {
        _id: 'id1',
        id: 'id1',
        caseId: '081-24-12345',
        trusteeId: 'T1',
        assignedOn: '2020-01-15',
        source: 'acms',
        createdOn: '2020-01-15T00:00:00Z',
        updatedOn: '2020-01-15T00:00:00Z',
        createdBy: { id: 'system', name: 'system' },
        updatedBy: { id: 'system', name: 'system' },
      };

      const upsertSpy = vi.fn();

      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          getAllCaseAppointments: vi.fn().mockResolvedValueOnce([activeCase]).mockResolvedValue([]),
          getActiveByTrusteeIdFromTrusteePartition: vi.fn().mockResolvedValue([activeCase]), // already present
          upsert: upsertSpy,
          countActiveMissingDateFiled: vi.fn().mockResolvedValue(0),
        }) as never,
      );

      await MigrateCaseAppointmentsUseCase.heal(context);

      expect(upsertSpy).not.toHaveBeenCalled();
    });
  });
});
