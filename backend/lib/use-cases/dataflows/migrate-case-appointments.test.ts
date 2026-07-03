import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
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

    test('returns failure for records with trusteeId=null', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({} as CaseAppointment);

      const records = [makeResolvedRecord({ trusteeId: null })];
      const result = await MigrateCaseAppointmentsUseCase.writePage(context, records);

      expect(result.successCount).toBe(0);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].reason).toBe('trustee-not-found');
      expect(result.remaining).toHaveLength(0);
      expect(result.recommendedVisibilitySeconds).toBe(0);
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

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
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

    test('backoff is capped at MAX_BACKOFF_MS', async () => {
      const sleepSpy = vi.spyOn(global, 'setTimeout');
      vi.spyOn(MockMongoRepository.prototype, 'upsert')
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockResolvedValue({} as CaseAppointment);
      const MAX_BACKOFF_MS = 10 * 60 * 1000;
      const records = [makeResolvedRecord()];
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        safeThresholdMs: 100 * 60 * 1000,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      await resultPromise;
      // All sleep durations should be <= MAX_BACKOFF_MS
      const sleepDurations = sleepSpy.mock.calls.map(([_, ms]) => ms as number).filter(Boolean);
      for (const duration of sleepDurations) {
        expect(duration).toBeLessThanOrEqual(MAX_BACKOFF_MS);
      }
    });

    test('trusteeId null results in immediate failure with no retry', async () => {
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert');
      const records = [makeResolvedRecord({ trusteeId: null })];
      const resultPromise = MigrateCaseAppointmentsUseCase.writePage(context, records, {
        safeThresholdMs: 58 * 60 * 1000,
        baseDelayMs: 100,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].reason).toBe('trustee-not-found');
      expect(upsertSpy).not.toHaveBeenCalled();
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

  describe('deleteAll', () => {
    test('success — returns deletedCount when repo call succeeds', async () => {
      const deleteAllBySourceSpy = vi.fn().mockResolvedValue({ deletedCount: 7 });
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          deleteAllBySource: deleteAllBySourceSpy,
        }) as never,
      );

      const result = await MigrateCaseAppointmentsUseCase.deleteAll(context);

      expect(deleteAllBySourceSpy).toHaveBeenCalledWith('acms');
      expect(result).toEqual({ data: { deletedCount: 7 } });
    });

    test('error — returns MaybeData error when repo throws', async () => {
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          deleteAllBySource: vi.fn().mockRejectedValue(new Error('db error')),
        }),
      );

      const result = await MigrateCaseAppointmentsUseCase.deleteAll(context);

      expect(result).toHaveProperty('error');
      expect(result).not.toHaveProperty('data');
    });
  });
});
