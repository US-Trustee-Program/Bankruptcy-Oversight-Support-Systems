import { vi } from 'vitest';
import { AggregationCursor } from 'mongodb';
import { TrusteeCaseAppointmentsMongoRepository } from './trustee-case-appointments.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { CollectionHumble } from '../../../humble-objects/mongo-humble';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import {
  CaseAppointment,
  CaseAppointmentInput,
  TrusteeCaseListItem,
} from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { TrusteeCasesSearchPredicate } from '@common/api/search';

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
    vi.restoreAllMocks();
    // Use public interface to reset singleton state between tests
    while (TrusteeCaseAppointmentsMongoRepository['instance']) {
      TrusteeCaseAppointmentsMongoRepository.dropInstance();
    }
    process.env.MONGO_CONNECTION_STRING = 'mongodb://localhost:27017';
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
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockResolvedValue({
        id: 'appt-existing',
        modifiedCount: 1,
        upsertedCount: 0,
      });
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

    test('should throw when the case-partition (primary) update fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error('primary update failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.updateCaseAppointment(baseAppointment)).rejects.toThrow(
        `Failed to update case appointment ${baseAppointment.id}.`,
      );
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
    test('paginates case partition: fetches by caseId, deletes per unique caseId', async () => {
      const batch = [
        { ...baseAppointment, caseId: '081-24-00001' },
        { ...baseAppointment, caseId: '081-24-00002' },
        { ...baseAppointment, caseId: '081-24-00001' }, // duplicate caseId
      ];
      // First find returns batch, second find returns empty (end of pagination)
      vi.spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValueOnce(batch) // case partition batch
        .mockResolvedValueOnce([]) // trustee partition batch (empty → done)
        .mockResolvedValue([]); // any subsequent finds
      const deleteManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValue(1);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.deleteAllBySource('acms');

      // 2 unique caseIds → 2 deleteMany calls on case partition
      expect(deleteManySpy).toHaveBeenCalledTimes(2);
      expect(result.deletedCount).toBe(2);
      repo.release();
    });

    test('returns 0 when both collections are already empty', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const deleteManySpy = vi.spyOn(MongoCollectionAdapter.prototype, 'deleteMany');
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.deleteAllBySource('acms');

      expect(deleteManySpy).not.toHaveBeenCalled();
      expect(result.deletedCount).toBe(0);
      repo.release();
    });

    test('logs and continues when trustee partition delete fails', async () => {
      const batch = [{ ...baseAppointment, caseId: '081-24-00001', trusteeId: TRUSTEE_ID }];
      vi.spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValueOnce(batch) // case partition batch
        .mockResolvedValueOnce([]) // case partition done
        .mockResolvedValueOnce(batch) // trustee partition batch
        .mockResolvedValue([]);
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValueOnce(1) // case partition delete succeeds
        .mockRejectedValueOnce(new Error('trustee partition delete failed'));
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      // Should not throw — trustee partition failure is best-effort
      const result = await repo.deleteAllBySource('acms');
      expect(result.deletedCount).toBe(1);
      repo.release();
    });

    test('continues pagination when first batch is exactly BATCH_SIZE (100)', async () => {
      // 100 items with unique caseIds — triggers a second find call
      const fullBatch = Array.from({ length: 100 }, (_, i) => ({
        ...baseAppointment,
        caseId: `081-24-${String(i).padStart(5, '0')}`,
      }));
      vi.spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValueOnce(fullBatch) // case partition: full batch → loop continues
        .mockResolvedValueOnce([]) // case partition: empty → done
        .mockResolvedValue([]); // trustee partition: empty → done
      const deleteManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValue(1);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.deleteAllBySource('acms');

      // 100 unique caseIds → 100 deleteMany calls
      expect(deleteManySpy).toHaveBeenCalledTimes(100);
      expect(result.deletedCount).toBe(100);
      repo.release();
    });

    test('throws when case partition find fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new Error('find failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.deleteAllBySource('acms')).rejects.toThrow(
        'Failed to delete case appointments with source acms.',
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

  describe('getCasesForTrustee', () => {
    const basePredicate: TrusteeCasesSearchPredicate = { limit: 25, offset: 0 };

    const baseItem: TrusteeCaseListItem = {
      caseId: '081-24-12345',
      caseNumber: '24-12345',
      courtDivisionName: 'Memphis',
      caseTitle: 'Debtor, Test',
      chapter: '7',
      dateFiled: '2024-01-15',
      appointedDate: '2024-01-15',
    };

    function mockAggregateCursor(facetResult: {
      metadata: { total: number }[];
      data: TrusteeCaseListItem[];
    }) {
      // adapter.paginate() calls cursor.next() directly (not for-await).
      // Provide both next() and async iterator for compatibility.
      const cursor = {
        next: vi.fn().mockResolvedValue(facetResult),
        [Symbol.asyncIterator]: async function* () {
          yield facetResult;
        },
      };
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockResolvedValue(
        cursor as unknown as AggregationCursor,
      );
    }

    // Helper: finds all $match stages in the rendered pipeline and searches
    // them for a field condition — position-independent, resilient to stage reordering.
    function findFieldInPipeline(
      spy: ReturnType<typeof vi.mocked<typeof CollectionHumble.prototype.aggregate>>,
      field: string,
    ): unknown {
      const rendered = spy.mock.calls[0][0] as unknown as Record<string, unknown>[];
      for (const stage of rendered) {
        const matchStage = stage.$match as Record<string, unknown> | undefined;
        if (!matchStage) continue;
        // Search top-level and within $and arrays
        if (field in matchStage) return matchStage[field];
        const andClauses = matchStage.$and as Record<string, unknown>[] | undefined;
        if (andClauses) {
          for (const clause of andClauses) {
            if (field in clause) return clause[field];
            // One more level deep for nested $and/$or
            const nested = (clause.$and ?? clause.$or) as Record<string, unknown>[] | undefined;
            if (nested) {
              for (const inner of nested) {
                if (field in inner) return inner[field];
              }
            }
          }
        }
      }
      return undefined;
    }

    function getMatchStages(
      spy: ReturnType<typeof vi.mocked<typeof CollectionHumble.prototype.aggregate>>,
    ): Record<string, unknown>[] {
      const rendered = spy.mock.calls[0][0] as unknown as Record<string, unknown>[];
      return rendered.filter((s) => '$match' in s).map((s) => s.$match as Record<string, unknown>);
    }

    test('returns data and metadata from the aggregate result', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].caseId).toBe(baseItem.caseId);
      expect(result.metadata.total).toBe(1);
      repo.release();
    });

    test('no filters — case match includes documentType and movedToCaseId base conditions', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPipeline(spy, '_case.documentType')).toBeDefined();
      expect(findFieldInPipeline(spy, '_case.movedToCaseId')).toBeDefined();
      expect(findFieldInPipeline(spy, '_case.chapter')).toBeUndefined();
      expect(findFieldInPipeline(spy, '_case.dateFiled')).toBeUndefined();
      repo.release();
    });

    test('caseStatus OPEN — case match includes a status-based $or condition', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, caseStatus: 'OPEN' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const matchStages = getMatchStages(spy);
      const hasOr = matchStages.some((m) => {
        const andClauses = m.$and as Record<string, unknown>[] | undefined;
        return andClauses?.some((c) => '$or' in c);
      });
      expect(hasOr).toBe(true);
      repo.release();
    });

    test('caseStatus CLOSED — case match includes a status-based $and condition', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, caseStatus: 'CLOSED' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const matchStages = getMatchStages(spy);
      const hasNestedAnd = matchStages.some((m) => {
        const andClauses = m.$and as Record<string, unknown>[] | undefined;
        return andClauses?.some((c) => '$and' in c);
      });
      expect(hasNestedAnd).toBe(true);
      repo.release();
    });

    test('caseStatus ALL — case match has no status condition beyond base two', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, caseStatus: 'ALL' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPipeline(spy, '_case.closedDate')).toBeUndefined();
      repo.release();
    });

    test('chapters filter — case match includes $in on _case.chapter', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, chapters: ['7', '13'] });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPipeline(spy, '_case.chapter')).toEqual({ $in: ['7', '13'] });
      repo.release();
    });

    test('filedDateFrom — case match includes $gte on _case.dateFiled', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, filedDateFrom: '2024-01-01' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPipeline(spy, '_case.dateFiled')).toMatchObject({ $gte: '2024-01-01' });
      repo.release();
    });

    test('filedDateTo — case match includes $lte on _case.dateFiled', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, filedDateTo: '2024-12-31' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPipeline(spy, '_case.dateFiled')).toMatchObject({ $lte: '2024-12-31' });
      repo.release();
    });

    test('divisionCodes — case match includes $in on _case.courtDivisionCode', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, {
        ...basePredicate,
        divisionCodes: ['081', '087'],
      });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPipeline(spy, '_case.courtDivisionCode')).toEqual({ $in: ['081', '087'] });
      repo.release();
    });

    test('empty result set — returns { data: [], metadata: { total: 0 } }', async () => {
      mockAggregateCursor({ metadata: [], data: [] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data).toHaveLength(0);
      expect(result.metadata.total).toBe(0);
      repo.release();
    });

    test('error thrown by aggregate — propagates to caller', async () => {
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockRejectedValue(
        new Error('mongo connection failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.getCasesForTrustee(TRUSTEE_ID, basePredicate)).rejects.toThrow(
        'mongo connection failed',
      );
      repo.release();
    });
  });
});
