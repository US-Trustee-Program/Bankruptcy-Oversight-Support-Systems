import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MigrateCaseAppointmentsUseCase, { CMMAP_CUTOFF_DATE } from './migrate-case-appointments';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import factory from '../../factory';
import { AcmsCaseAppointmentRecord } from '../gateways.types';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { TrusteeProfessionalId } from '@common/cams/trustee-professional-ids';
import { NotFoundError } from '../../common-errors/not-found-error';

function makeRecord(override: Partial<AcmsCaseAppointmentRecord> = {}): AcmsCaseAppointmentRecord {
  return {
    id: 1001,
    caseId: '081-24-12345',
    acmsProfessionalId: 'NY-00063',
    assignDate: 20200101,
    apptDate: 20200110,
    unassignDate: null,
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

function setupStateRepo() {
  const upsertSpy = vi.fn().mockResolvedValue({} as never);
  vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
    Object.assign(new MockMongoRepository(), {
      read: vi.fn().mockRejectedValue(new NotFoundError('test')),
      upsert: upsertSpy,
    }),
  );
  return { upsertSpy };
}

describe('MigrateCaseAppointmentsUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('processPage', () => {
    test('happy path — creates case appointments for each resolved record', async () => {
      setupStateRepo();
      const records = [makeRecord({ id: 1001 }), makeRecord({ id: 1002, caseId: '081-24-99999' })];

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockResolvedValue(records),
      } as never);

      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAll: vi.fn().mockResolvedValue([makeProfessionalId()]),
        }),
      );

      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      const result = await MigrateCaseAppointmentsUseCase.processPage(context, null, 2);

      expect(result.status).toBe('continue');
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'acms', trusteeId: 'trustee-001' }),
      );
    });

    test('trustee not found — skips record and returns failure in result', async () => {
      setupStateRepo();
      const records = [makeRecord()];

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockResolvedValue(records),
      } as never);

      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAll: vi.fn().mockResolvedValue([]),
        }),
      );

      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      const result = await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      expect(createSpy).not.toHaveBeenCalled();
      expect(result.status).toBe('done');
      expect((result as { failures: { reason: string }[] }).failures).toHaveLength(1);
      expect((result as { failures: { reason: string }[] }).failures[0].reason).toBe(
        'trustee-not-found',
      );
    });

    test('empty page — updates state to COMPLETED and returns empty status', async () => {
      const { upsertSpy } = setupStateRepo();

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockResolvedValue([]),
      } as never);

      const result = await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      expect(result.status).toBe('empty');
      expect(upsertSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
    });

    test('done status — returns done and writes COMPLETED when page is smaller than pageSize', async () => {
      const { upsertSpy } = setupStateRepo();
      const records = [makeRecord({ id: 1001 }), makeRecord({ id: 1002, caseId: '081-24-99999' })];

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockResolvedValue(records),
      } as never);

      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAll: vi.fn().mockResolvedValue([makeProfessionalId()]),
        }),
      );

      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({} as CaseAppointment);

      const result = await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      expect(result.status).toBe('done');
      expect((result as { nextLastId: null }).nextLastId).toBeNull();
      expect(upsertSpy).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'COMPLETED' }));
    });

    test('professional-ids-load-error — returns error when findAll throws', async () => {
      setupStateRepo();
      const records = [makeRecord()];

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockResolvedValue(records),
      } as never);

      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAll: vi.fn().mockRejectedValue(new Error('db error')),
        }),
      );

      const result = await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      expect(result.status).toBe('error');
      expect(result).toHaveProperty('error');
    });

    test('returns error status when readMigrationState fails with non-NotFound error', async () => {
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockRejectedValue(new Error('connection refused')),
          upsert: vi.fn(),
        }),
      );

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn(),
      } as never);

      const result = await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      expect(result.status).toBe('error');
    });

    test('returns error status when getCmmapAppointments throws', async () => {
      setupStateRepo();
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockRejectedValue(new Error('ACMS unavailable')),
      } as never);

      const result = await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      expect(result.status).toBe('error');
    });

    test('createCaseAppointment failure — record pushed to failures and returned in result', async () => {
      setupStateRepo();
      const records = [makeRecord()];

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockResolvedValue(records),
      } as never);

      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAll: vi.fn().mockResolvedValue([makeProfessionalId()]),
        }),
      );

      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(
        new Error('insert failed'),
      );

      const result = await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      expect(result.status).toBe('done');
      expect((result as { failures: { reason: string }[] }).failures).toHaveLength(1);
      expect((result as { failures: { reason: string }[] }).failures[0].reason).toContain(
        'insert failed',
      );
    });

    test('appointedDate omitted when apptDate is null', async () => {
      setupStateRepo();
      const records = [makeRecord({ apptDate: null })];

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockResolvedValue(records),
      } as never);

      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAll: vi.fn().mockResolvedValue([makeProfessionalId()]),
        }),
      );

      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      const callArg = createSpy.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('appointedDate');
    });

    test('passes CMMAP_CUTOFF_DATE as 4th argument to getCmmapAppointments', async () => {
      setupStateRepo();
      const getCmmapSpy = vi.fn().mockResolvedValue([]);
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: getCmmapSpy,
      } as never);

      await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      expect(getCmmapSpy).toHaveBeenCalledWith(context, 0, 10, CMMAP_CUTOFF_DATE);
    });

    test('dates are formatted as ISO strings, not raw integers', async () => {
      setupStateRepo();
      const records = [
        makeRecord({ assignDate: 20200615, apptDate: 20200620, unassignDate: 20210101 }),
      ];

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockResolvedValue(records),
      } as never);

      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAll: vi.fn().mockResolvedValue([makeProfessionalId()]),
        }),
      );

      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedOn: '2020-06-15',
          appointedDate: '2020-06-20',
          unassignedOn: '2021-01-01',
        }),
      );
    });

    test('unassignedOn omitted when unassignDate is null', async () => {
      setupStateRepo();
      const records = [makeRecord({ unassignDate: null })];

      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointments: vi.fn().mockResolvedValue(records),
      } as never);

      vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAll: vi.fn().mockResolvedValue([makeProfessionalId()]),
        }),
      );

      const createSpy = vi
        .spyOn(MockMongoRepository.prototype, 'upsert')
        .mockResolvedValue({} as CaseAppointment);

      await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

      const callArg = createSpy.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('unassignedOn');
    });

    test('invalid date formats are returned as failures in result', async () => {
      setupStateRepo();

      const invalidDateCases = [
        { date: 202, _description: 'too short' },
        { date: 20240231, _description: 'Feb 31st does not exist' },
        { date: 0, _description: 'zero' },
        { date: 99999999, _description: 'out of range year' },
      ];

      for (const { date } of invalidDateCases) {
        const records = [makeRecord({ assignDate: date })];

        vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
          getCmmapAppointments: vi.fn().mockResolvedValue(records),
        } as never);

        vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
          Object.assign(new MockMongoRepository(), {
            findAll: vi.fn().mockResolvedValue([makeProfessionalId()]),
          }),
        );

        const result = await MigrateCaseAppointmentsUseCase.processPage(context, null, 10);

        type DoneResult = { failures: { reason: string }[]; successCount: number };
        expect(result.status).toBe('done');
        expect((result as unknown as DoneResult).failures).toHaveLength(1);
        expect((result as unknown as DoneResult).failures[0].reason).toContain('Invalid');
        expect((result as unknown as DoneResult).successCount).toBe(0);
      }
    });
  });

  describe('updateMigrationState', () => {
    test('re-reads state from repo when existingState arg is omitted', async () => {
      const upsertSpy = vi.fn().mockResolvedValue({});
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockResolvedValue({
            id: 'state-1',
            documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
            lastId: 50,
            processedCount: 50,
            status: 'IN_PROGRESS',
            startedAt: '2025-01-01T00:00:00Z',
            lastUpdatedAt: '2025-01-02T00:00:00Z',
          }),
          upsert: upsertSpy,
        }),
      );

      await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
        lastId: 100,
        processedCount: 100,
        status: 'IN_PROGRESS',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ lastId: 100, processedCount: 100 }),
      );
    });

    test('uses fallback null state when repo.read throws NotFoundError', async () => {
      const upsertSpy = vi.fn().mockResolvedValue({});
      vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockRejectedValue(new NotFoundError('test')),
          upsert: upsertSpy,
        }),
      );

      await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
        lastId: null,
        processedCount: 0,
        status: 'IN_PROGRESS',
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'IN_PROGRESS', lastId: null }),
      );
    });
  });

  describe('deleteAll', () => {
    test('success — returns deletedCount when repo call succeeds', async () => {
      const deleteAllBySourceSpy = vi.fn().mockResolvedValue({ deletedCount: 7 });
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          deleteAllBySource: deleteAllBySourceSpy,
        }),
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
