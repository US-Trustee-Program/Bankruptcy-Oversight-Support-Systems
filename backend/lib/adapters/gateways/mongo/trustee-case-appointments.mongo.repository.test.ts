import { vi } from 'vitest';
import { TrusteeCaseAppointmentsMongoRepository } from './trustee-case-appointments.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { CaseAppointment, CaseAppointmentInput } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('TrusteeCaseAppointmentsMongoRepository', () => {
  const CASE_ID = '081-24-12345';
  const TRUSTEE_ID = 'TRUSTEE-001';

  const baseAppointment: CaseAppointment = {
    id: 'appt-001',
    caseId: CASE_ID,
    trusteeId: TRUSTEE_ID,
    assignedOn: '2024-01-15',
    source: 'acms',
    createdOn: '2024-01-15T00:00:00.000Z',
    updatedOn: '2024-01-15T00:00:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  beforeEach(() => {
    process.env.MONGO_CONNECTION_STRING = 'mongodb://localhost:27017';
  });

  afterEach(() => {
    TrusteeCaseAppointmentsMongoRepository['instance'] = null;
    TrusteeCaseAppointmentsMongoRepository['referenceCount'] = 0;
    vi.restoreAllMocks();
  });

  test('should return singleton instance', async () => {
    const context = await createMockApplicationContext();
    const a = TrusteeCaseAppointmentsMongoRepository.getInstance(context);
    const b = TrusteeCaseAppointmentsMongoRepository.getInstance(context);
    expect(a).toBe(b);
    a.release();
    b.release();
  });

  test('should release instance when reference count reaches zero', async () => {
    const context = await createMockApplicationContext();
    const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);
    expect(TrusteeCaseAppointmentsMongoRepository['instance']).not.toBeNull();
    repo.release();
    expect(TrusteeCaseAppointmentsMongoRepository['instance']).toBeNull();
  });

  describe('getByCaseId', () => {
    test('should return appointments for the given caseId from the case partition', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([baseAppointment]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getByCaseId(CASE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].caseId).toBe(CASE_ID);
      repo.release();
    });

    test('should return empty array when no appointments exist for caseId', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getByCaseId(CASE_ID);

      expect(result).toHaveLength(0);
      repo.release();
    });
  });

  describe('getActiveByCaseId', () => {
    test('should return the active appointment when one exists', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(baseAppointment);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getActiveByCaseId(CASE_ID);

      expect(result).not.toBeNull();
      expect(result!.caseId).toBe(CASE_ID);
      repo.release();
    });

    test('should return null when no active appointment exists', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(null);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getActiveByCaseId(CASE_ID);

      expect(result).toBeNull();
      repo.release();
    });
  });

  describe('getActiveByTrusteeId', () => {
    test('should return active appointments for the trustee from the trustee partition', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([baseAppointment]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getActiveByTrusteeId(TRUSTEE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].trusteeId).toBe(TRUSTEE_ID);
      repo.release();
    });
  });

  describe('upsert', () => {
    test('should write to case partition using replaceOne with upsert=true', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockResolvedValue({
        id: 'appt-new',
        modifiedCount: 0,
        upsertedCount: 1,
      });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const input: CaseAppointmentInput = {
        caseId: CASE_ID,
        trusteeId: TRUSTEE_ID,
        assignedOn: '2024-01-15',
        source: 'acms',
      };

      const result = await repo.upsert(input);

      expect(result.id).toBe('appt-new');
      expect(result.caseId).toBe(CASE_ID);
      repo.release();
    });

    test('should be idempotent — second write replaces first without error', async () => {
      const replaceOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: 'appt-existing', modifiedCount: 1, upsertedCount: 0 });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const input: CaseAppointmentInput = {
        caseId: CASE_ID,
        trusteeId: TRUSTEE_ID,
        assignedOn: '2024-01-15',
        source: 'acms',
      };

      // Call upsert twice — should not throw on second call
      await repo.upsert(input);
      const result = await repo.upsert(input);

      expect(result.id).toBe('appt-existing');
      // 2 calls per upsert (case + trustee partitions) × 2 upserts = 4
      expect(replaceOneSpy).toHaveBeenCalledTimes(4);
      repo.release();
    });

    test('should log and continue when the trustee-partition write fails', async () => {
      const replaceOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValueOnce({ id: 'appt-primary', modifiedCount: 0, upsertedCount: 1 })
        .mockRejectedValueOnce(new Error('trustee partition write failed'));
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const input: CaseAppointmentInput = {
        caseId: CASE_ID,
        trusteeId: TRUSTEE_ID,
        assignedOn: '2024-01-15',
        source: 'acms',
      };

      const result = await repo.upsert(input);

      expect(result.id).toBe('appt-primary');
      expect(replaceOneSpy).toHaveBeenCalledTimes(2);
      repo.release();
    });

    test('should throw when the case-partition (primary) write fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error('primary write failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(
        repo.upsert({ caseId: CASE_ID, trusteeId: TRUSTEE_ID, assignedOn: '2024-01-15' }),
      ).rejects.toThrow(`Failed to upsert case appointment for case ${CASE_ID}`);
      repo.release();
    });
  });

  describe('updateCaseAppointment', () => {
    test('should update both partitions and return the updated document', async () => {
      const replaceOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue(undefined);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const updated = { ...baseAppointment, unassignedOn: '2024-06-01' };
      const result = await repo.updateCaseAppointment(updated);

      expect(replaceOneSpy).toHaveBeenCalledTimes(2);
      expect(result.unassignedOn).toBe('2024-06-01');
      repo.release();
    });

    test('should log and continue when the trustee-partition update fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('trustee partition update failed'));
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.updateCaseAppointment(baseAppointment)).resolves.toBeDefined();
      repo.release();
    });
  });

  describe('delete', () => {
    test('should delete from both partitions', async () => {
      const deleteOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteOne')
        .mockResolvedValue(undefined);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.delete('appt-001');

      expect(deleteOneSpy).toHaveBeenCalledTimes(2);
      repo.release();
    });

    test('should log and continue when the trustee-partition delete fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('trustee partition delete failed'));
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.delete('appt-001')).resolves.toBeUndefined();
      repo.release();
    });
  });

  describe('deleteAllBySource', () => {
    test('should delete from both partitions and return count from case partition', async () => {
      const deleteManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.deleteAllBySource('acms');

      expect(deleteManySpy).toHaveBeenCalledTimes(2);
      expect(result.deletedCount).toBe(5);
      repo.release();
    });

    test('should log and continue when the trustee-partition delete fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValueOnce(3)
        .mockRejectedValueOnce(new Error('trustee partition delete failed'));
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.deleteAllBySource('acms');

      expect(result.deletedCount).toBe(3);
      repo.release();
    });

    test('should throw when the case-partition (primary) delete fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteMany').mockRejectedValue(
        new Error('primary delete failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.deleteAllBySource('acms')).rejects.toThrow(
        'Failed to delete all case appointments with source acms.',
      );
      repo.release();
    });
  });

  describe('getAllCaseAppointments', () => {
    test('should return all appointments when lastId is null', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
        { ...baseAppointment, _id: 'mongo-1' },
        { ...baseAppointment, _id: 'mongo-2', id: 'appt-002' },
      ]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getAllCaseAppointments(null, 100);

      expect(result).toHaveLength(2);
      repo.release();
    });

    test('should filter by _id > lastId when provided', async () => {
      const findSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue([{ ...baseAppointment, _id: 'mongo-2' }]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getAllCaseAppointments('mongo-1', 50);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.arrayContaining([
            expect.objectContaining({ condition: 'GREATER_THAN', rightOperand: 'mongo-1' }),
          ]),
        }),
        expect.any(Object),
        50,
      );
      repo.release();
    });
  });

  describe('findActiveMissingAppointedDate', () => {
    test('should return active appointments with no appointedDate', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
        { ...baseAppointment, _id: 'mongo-1' },
      ]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.findActiveMissingAppointedDate(null, 100);

      expect(result).toHaveLength(1);
      repo.release();
    });
  });
});
