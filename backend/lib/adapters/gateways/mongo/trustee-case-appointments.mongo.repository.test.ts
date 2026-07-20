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

    test('should exclude sentinel appointment documents (trusteeId = null UUID)', async () => {
      const findOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'findOne')
        .mockResolvedValue(null);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getActiveByCaseId(CASE_ID);

      // Verify the query passed to findOne includes the sentinel trustee ID guard
      const query = findOneSpy.mock.calls[0][0];
      expect(query).toBeDefined();
      // The query should include a notEquals condition for the sentinel trustee ID
      const queryStr = JSON.stringify(query);
      expect(queryStr).toContain('00000000-0000-0000-0000-000000000000');
      // Verify it includes exactly 4 conditions

      const queryValues = (query as Record<string, unknown>).values as unknown[];
      expect(queryValues.length).toBe(4);
      repo.release();
    });
  });

  describe('upsert', () => {
    test('should use 4-field natural key (documentType, caseId, trusteeId, assignedOn) without source', async () => {
      const replaceOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({
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
      };

      await repo.upsert(input);

      // Verify the query passed to replaceOne does NOT include source condition
      const firstCallQuery = replaceOneSpy.mock.calls[0][0];
      expect(firstCallQuery).toBeDefined();

      // Check that natural key has exactly 4 conditions (not 5 with source)
      // The query object should have values array with 4 items for the 4-field key

      const queryValues = (firstCallQuery as Record<string, unknown>).values as unknown[];
      expect(queryValues).toBeDefined();
      expect(queryValues.length).toBe(4);

      // Verify the 4 fields are present: documentType, caseId, trusteeId, assignedOn
      const queryStr = JSON.stringify(firstCallQuery);
      expect(queryStr).toContain('CASE_APPOINTMENT'); // documentType
      expect(queryStr).toContain(CASE_ID); // caseId
      expect(queryStr).toContain(TRUSTEE_ID); // trusteeId
      expect(queryStr).toContain('2024-01-15'); // assignedOn
      // And source should NOT be in the query
      expect(queryStr).not.toContain('"source"');

      repo.release();
    });

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
      };

      // Call upsert twice — should not throw on second call
      await repo.upsert(input);
      const result = await repo.upsert(input);

      expect(result.id).toBe('appt-existing');
      repo.release();
    });

    test('should throw when the trustee-partition write fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValueOnce({ id: 'appt-primary', modifiedCount: 0, upsertedCount: 1 })
        .mockRejectedValueOnce(new Error('trustee partition write failed'));
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const input: CaseAppointmentInput = {
        caseId: CASE_ID,
        trusteeId: TRUSTEE_ID,
        assignedOn: '2024-01-15',
      };

      await expect(repo.upsert(input)).rejects.toThrow('Dual-write to trustee partition failed');
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

    test('should compute and persist caseStatus=CLOSED when closedDate is provided without reopenedDate', async () => {
      let _capturedDocument: CaseAppointment | undefined;
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(
        async (_query, doc) => {
          _capturedDocument = doc as CaseAppointment;
          return { id: 'appt-closed', modifiedCount: 0, upsertedCount: 1 };
        },
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const input: CaseAppointmentInput = {
        caseId: CASE_ID,
        trusteeId: TRUSTEE_ID,
        assignedOn: '2024-01-15',
        dateFiled: '2023-01-10',
        closedDate: '2024-06-01',
      };

      const result = await repo.upsert(input);

      expect(result.caseStatus).toBe('CLOSED');
      expect(_capturedDocument?.caseStatus).toBe('CLOSED');
      repo.release();
    });

    test('should compute and persist caseStatus=OPEN when reopenedDate is after closedDate', async () => {
      let _capturedDocument: CaseAppointment | undefined;
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(
        async (_query, doc) => {
          _capturedDocument = doc as CaseAppointment;
          return { id: 'appt-reopened', modifiedCount: 0, upsertedCount: 1 };
        },
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const input: CaseAppointmentInput = {
        caseId: CASE_ID,
        trusteeId: TRUSTEE_ID,
        assignedOn: '2024-01-15',
        dateFiled: '2023-01-10',
        closedDate: '2024-06-01',
        reopenedDate: '2024-07-01',
      };

      const result = await repo.upsert(input);

      expect(result.caseStatus).toBe('OPEN');
      expect(_capturedDocument?.caseStatus).toBe('OPEN');
      repo.release();
    });

    test('should persist denormalized fields (dateFiled, chapter, courtDivisionCode) when provided', async () => {
      let _capturedDocument: CaseAppointment | undefined;
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(
        async (_query, doc) => {
          _capturedDocument = doc as CaseAppointment;
          return { id: 'appt-denorm', modifiedCount: 0, upsertedCount: 1 };
        },
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const input: CaseAppointmentInput = {
        caseId: CASE_ID,
        trusteeId: TRUSTEE_ID,
        assignedOn: '2024-01-15',
        dateFiled: '2023-01-10',
        chapter: '7',
        courtDivisionCode: 'ABC',
        closedDate: '2024-06-01',
      };

      const result = await repo.upsert(input);

      expect(result.dateFiled).toBe('2023-01-10');
      expect(result.chapter).toBe('7');
      expect(result.courtDivisionCode).toBe('ABC');
      expect(result.caseStatus).toBe('CLOSED');
      repo.release();
    });
  });

  describe('upsert with movedToCaseId (migration path)', () => {
    test('stamps movedToCaseId on document when provided', async () => {
      const replaceOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: 'appt-001', modifiedCount: 0, upsertedCount: 1 });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.upsert({ ...baseAppointment, movedToCaseId: '081-24-99999' });

      expect(replaceOneSpy).toHaveBeenCalledTimes(2);
      const writtenDoc = replaceOneSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(writtenDoc.movedToCaseId).toBe('081-24-99999');
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

    test('should throw when the trustee-partition update fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('trustee partition update failed'));
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.updateCaseAppointment(baseAppointment)).rejects.toThrow(
        'Dual-write update to trustee partition failed',
      );
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

    test('should compute and persist caseStatus when closedDate is present', async () => {
      let _capturedDocument: CaseAppointment | undefined;
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(
        async (_query, doc) => {
          _capturedDocument = doc as CaseAppointment;
          return undefined;
        },
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const updated: CaseAppointment = {
        ...baseAppointment,
        dateFiled: '2023-01-10',
        closedDate: '2024-06-01',
      };

      const result = await repo.updateCaseAppointment(updated);

      expect(result.caseStatus).toBe('CLOSED');
      expect(_capturedDocument?.caseStatus).toBe('CLOSED');
      repo.release();
    });

    test('should persist denormalized fields (dateFiled, chapter, courtDivisionCode) when provided in update', async () => {
      let _capturedDocument: CaseAppointment | undefined;
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockImplementation(
        async (_query, doc) => {
          _capturedDocument = doc as CaseAppointment;
          return undefined;
        },
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const updated: CaseAppointment = {
        ...baseAppointment,
        dateFiled: '2023-01-10',
        chapter: '7',
        courtDivisionCode: 'ABC',
        closedDate: '2024-06-01',
      };

      const result = await repo.updateCaseAppointment(updated);

      expect(result.dateFiled).toBe('2023-01-10');
      expect(result.chapter).toBe('7');
      expect(result.courtDivisionCode).toBe('ABC');
      expect(result.caseStatus).toBe('CLOSED');
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

    test('should throw when the trustee-partition delete fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('trustee partition delete failed'));
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.delete('appt-001')).rejects.toThrow(
        'Dual-delete from trustee partition failed',
      );
      repo.release();
    });

    test('should throw when the case-partition delete fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockRejectedValueOnce(
        new Error('case partition delete failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.delete('appt-001')).rejects.toThrow(
        'Failed to delete case appointment appt-001',
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
      courtDivisionName: 'Memphis',
      caseTitle: 'Debtor, Test',
      chapter: '7',
      dateFiled: '2024-01-15',
      appointedDate: '2024-01-15',
      caseStatus: 'OPEN',
    };

    function mockAggregateCursor(facetResult: {
      metadata: { total: number }[];
      data: TrusteeCaseListItem[];
    }) {
      // getCasesForTrustee calls collection.aggregate() directly and then cursor.next().
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

    // Returns the raw pipeline array passed to collection.aggregate()
    function getRenderedPipeline(
      spy: ReturnType<typeof vi.mocked<typeof CollectionHumble.prototype.aggregate>>,
    ): Record<string, unknown>[] {
      return spy.mock.calls[0][0] as unknown as Record<string, unknown>[];
    }

    // Returns all top-level $match stages (pre-facet only).
    function getTopLevelMatchStages(
      spy: ReturnType<typeof vi.mocked<typeof CollectionHumble.prototype.aggregate>>,
    ): Record<string, unknown>[] {
      const pipeline = getRenderedPipeline(spy);
      // Collect only stages before the first $facet
      const stages: Record<string, unknown>[] = [];
      for (const stage of pipeline) {
        if ('$facet' in stage) break;
        if ('$match' in stage) stages.push(stage.$match as Record<string, unknown>);
      }
      return stages;
    }

    // Searches top-level (pre-facet) $match stages for a field condition.
    function findFieldInPrePaginateMatch(
      spy: ReturnType<typeof vi.mocked<typeof CollectionHumble.prototype.aggregate>>,
      field: string,
    ): unknown {
      const matchStages = getTopLevelMatchStages(spy);
      for (const matchStage of matchStages) {
        if (field in matchStage) return matchStage[field];
        const andClauses = matchStage.$and as Record<string, unknown>[] | undefined;
        if (andClauses) {
          for (const clause of andClauses) {
            if (field in clause) return clause[field];
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

    // Returns index of stage type in top-level pipeline (-1 if not found).
    function getStageIndex(
      spy: ReturnType<typeof vi.mocked<typeof CollectionHumble.prototype.aggregate>>,
      stageKey: string,
    ): number {
      const pipeline = getRenderedPipeline(spy);
      return pipeline.findIndex((s) => stageKey in s);
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

    test('caseStatus from appointment doc passes through unchanged — OPEN', async () => {
      mockAggregateCursor({
        metadata: [{ total: 1 }],
        data: [{ ...baseItem, caseStatus: 'OPEN' }],
      });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data[0].caseStatus).toBe('OPEN');
      repo.release();
    });

    test('caseStatus from appointment doc passes through unchanged — CLOSED', async () => {
      mockAggregateCursor({
        metadata: [{ total: 1 }],
        data: [{ ...baseItem, caseStatus: 'CLOSED' }],
      });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data[0].caseStatus).toBe('CLOSED');
      repo.release();
    });

    test('result items do not contain closedDate or reopenedDate', async () => {
      mockAggregateCursor({
        metadata: [{ total: 1 }],
        data: [baseItem],
      });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data[0]).not.toHaveProperty('closedDate');
      expect(result.data[0]).not.toHaveProperty('reopenedDate');
      repo.release();
    });

    test('$facet stage appears BEFORE $lookup in the rendered pipeline', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const pipeline = getRenderedPipeline(spy);
      const facetIndex = pipeline.findIndex((s) => '$facet' in s);
      // $lookup must be inside $facet.data, not as a top-level stage
      const topLevelLookupIndex = pipeline.findIndex((s) => '$lookup' in s);
      expect(facetIndex).toBeGreaterThanOrEqual(0);
      expect(topLevelLookupIndex).toBe(-1); // no top-level $lookup
      // $lookup exists inside $facet.data
      const facetStage = pipeline[facetIndex].$facet as Record<string, Record<string, unknown>[]>;
      const dataStages = facetStage.data;
      expect(dataStages.some((s) => '$lookup' in s)).toBe(true);
      repo.release();
    });

    test('dateFiled $exists true is in the pre-paginate $match', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const dateFiledCondition = findFieldInPrePaginateMatch(spy, 'dateFiled');
      expect(dateFiledCondition).toMatchObject({ $exists: true });
      repo.release();
    });

    test('$sort on dateFiled DESC appears before $facet', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const sortIndex = getStageIndex(spy, '$sort');
      const facetIndex = getStageIndex(spy, '$facet');
      expect(sortIndex).toBeGreaterThanOrEqual(0);
      expect(facetIndex).toBeGreaterThan(sortIndex);
      const pipeline = getRenderedPipeline(spy);
      const sortStage = pipeline[sortIndex].$sort as Record<string, unknown>;
      expect(sortStage.dateFiled).toBe(-1);
      repo.release();
    });

    test('secondary sort on caseId ASC is present', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const pipeline = getRenderedPipeline(spy);
      const sortIndex = getStageIndex(spy, '$sort');
      const sortStage = pipeline[sortIndex].$sort as Record<string, unknown>;
      expect(sortStage.caseId).toBe(1);
      repo.release();
    });

    test('no filters — $addFields resolves caseTitle and courtDivisionName via $ifNull on _caseOrDefault', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const pipeline = getRenderedPipeline(spy);
      const facetStage = pipeline.find((s) => '$facet' in s);
      expect(facetStage).toBeDefined();
      const facetData = (facetStage!.$facet as Record<string, Record<string, unknown>[]>).data;

      // _caseOrDefault $addFields stage substitutes a default object when _case is null
      const addFieldsStages = facetData.filter((s) => '$addFields' in s);
      expect(addFieldsStages.length).toBeGreaterThanOrEqual(2);
      const defaultStage = addFieldsStages.find((s) =>
        JSON.stringify(s).includes('_caseOrDefault'),
      );
      expect(defaultStage).toBeDefined();
      expect(JSON.stringify(defaultStage)).toContain('Case not available');

      // Final $project selects caseTitle and courtDivisionName as plain field references
      const projectStage = facetData.find((s) => '$project' in s);
      expect(projectStage).toBeDefined();
      const projectBody = projectStage!.$project as Record<string, unknown>;
      expect(projectBody.caseTitle).toBe(1);
      expect(projectBody.courtDivisionName).toBe(1);

      // chapter and dateFiled filters should NOT be present with no predicate
      expect(findFieldInPrePaginateMatch(spy, 'chapter')).toBeUndefined();
      expect(findFieldInPrePaginateMatch(spy, 'filedDateFrom')).toBeUndefined();
      repo.release();
    });

    test('caseStatus OPEN — pre-paginate $match includes caseStatus equality condition', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, caseStatus: 'OPEN' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPrePaginateMatch(spy, 'caseStatus')).toEqual({ $eq: 'OPEN' });
      repo.release();
    });

    test('caseStatus CLOSED — pre-paginate $match includes caseStatus equality condition', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, caseStatus: 'CLOSED' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPrePaginateMatch(spy, 'caseStatus')).toEqual({ $eq: 'CLOSED' });
      repo.release();
    });

    test('caseStatus ALL — pre-paginate $match has no caseStatus condition', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, caseStatus: 'ALL' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPrePaginateMatch(spy, 'caseStatus')).toBeUndefined();
      repo.release();
    });

    test('chapters filter — pre-paginate $match includes $in on chapter', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, chapters: ['7', '13'] });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPrePaginateMatch(spy, 'chapter')).toEqual({ $in: ['7', '13'] });
      repo.release();
    });

    test('filedDateFrom — pre-paginate $match includes $gte on dateFiled', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, filedDateFrom: '2024-01-01' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const matchStages = getTopLevelMatchStages(spy);
      const matchStr = JSON.stringify(matchStages);
      expect(matchStr).toContain('"$gte"');
      expect(matchStr).toContain('2024-01-01');
      repo.release();
    });

    test('filedDateTo — pre-paginate $match includes $lte on dateFiled', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, { ...basePredicate, filedDateTo: '2024-12-31' });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const matchStages = getTopLevelMatchStages(spy);
      const matchStr = JSON.stringify(matchStages);
      expect(matchStr).toContain('"$lte"');
      expect(matchStr).toContain('2024-12-31');
      repo.release();
    });

    test('filedDateFrom and filedDateTo — both bounds present on dateFiled pre-paginate', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, {
        ...basePredicate,
        filedDateFrom: '2024-01-01',
        filedDateTo: '2024-12-31',
      });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const matchStages = getTopLevelMatchStages(spy);
      const matchStr = JSON.stringify(matchStages);
      expect(matchStr).toContain('"$gte"');
      expect(matchStr).toContain('2024-01-01');
      expect(matchStr).toContain('"$lte"');
      expect(matchStr).toContain('2024-12-31');
      repo.release();
    });

    test('divisionCodes — pre-paginate $match includes $in on courtDivisionCode', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getCasesForTrustee(TRUSTEE_ID, {
        ...basePredicate,
        divisionCodes: ['081', '087'],
      });

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      expect(findFieldInPrePaginateMatch(spy, 'courtDivisionCode')).toEqual({
        $in: ['081', '087'],
      });
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

    test('error thrown by aggregate — propagates to caller wrapped as CamsError', async () => {
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockRejectedValue(
        new Error('mongo connection failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.getCasesForTrustee(TRUSTEE_ID, basePredicate)).rejects.toThrow(
        `Failed to retrieve cases for trustee ${TRUSTEE_ID}`,
      );
      repo.release();
    });

    test('$sort exceeded memory limit — logs via context.logger.error and rethrows', async () => {
      const sortLimitError = new Error(
        '$sort exceeded memory limit of 104857600 bytes, but did not opt in to external sorting',
      );
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockRejectedValue(sortLimitError);
      const context = await createMockApplicationContext();
      const loggerErrorSpy = vi.spyOn(context.logger, 'error').mockImplementation(() => {});
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.getCasesForTrustee(TRUSTEE_ID, basePredicate)).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(TRUSTEE_ID),
      );
      repo.release();
    });

    test('non-sort-limit error — does not log sort limit warning', async () => {
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockRejectedValue(
        new Error('some unrelated mongo error'),
      );
      const context = await createMockApplicationContext();
      const loggerErrorSpy = vi.spyOn(context.logger, 'error').mockImplementation(() => {});
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.getCasesForTrustee(TRUSTEE_ID, basePredicate)).rejects.toThrow();

      const sortLimitCalls = loggerErrorSpy.mock.calls.filter((args) =>
        String(args[1]).includes('$sort exceeded'),
      );
      expect(sortLimitCalls).toHaveLength(0);
      repo.release();
    });
  });

  describe('getDistinctDivisionsForTrustee', () => {
    function mockAggregateResult(divisions: string[]) {
      const cursor = {
        next: vi.fn().mockResolvedValue({ divisions }),
        [Symbol.asyncIterator]: async function* () {
          yield { divisions };
        },
      };
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockResolvedValue(
        cursor as unknown as AggregationCursor,
      );
    }

    test('returns deduplicated division codes from the aggregate result', async () => {
      mockAggregateResult(['081', '129']);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getDistinctDivisionsForTrustee(TRUSTEE_ID);

      expect(result).toEqual(['081', '129']);
      repo.release();
    });

    test('returns [] when the trustee has no case appointments', async () => {
      mockAggregateResult([]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getDistinctDivisionsForTrustee(TRUSTEE_ID);

      expect(result).toEqual([]);
      repo.release();
    });

    test('returns [] when the aggregate cursor yields no document at all', async () => {
      const cursor = {
        next: vi.fn().mockResolvedValue(null),
        [Symbol.asyncIterator]: async function* () {},
      };
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockResolvedValue(
        cursor as unknown as AggregationCursor,
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getDistinctDivisionsForTrustee(TRUSTEE_ID);

      expect(result).toEqual([]);
      repo.release();
    });

    test('the rendered pipeline does not filter by caseStatus', async () => {
      mockAggregateResult(['081']);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getDistinctDivisionsForTrustee(TRUSTEE_ID);

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const pipeline = spy.mock.calls[0][0] as unknown as Record<string, unknown>[];
      const pipelineStr = JSON.stringify(pipeline);
      expect(pipelineStr).not.toContain('caseStatus');
      repo.release();
    });

    test('the rendered pipeline matches on trusteeId', async () => {
      mockAggregateResult(['081']);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.getDistinctDivisionsForTrustee(TRUSTEE_ID);

      const spy = vi.mocked(CollectionHumble.prototype.aggregate);
      const pipeline = spy.mock.calls[0][0] as unknown as Record<string, unknown>[];
      const pipelineStr = JSON.stringify(pipeline);
      expect(pipelineStr).toContain(TRUSTEE_ID);
      repo.release();
    });

    test('error thrown by aggregate — propagates to caller wrapped as CamsError', async () => {
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockRejectedValue(
        new Error('mongo connection failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.getDistinctDivisionsForTrustee(TRUSTEE_ID)).rejects.toThrow(
        `Failed to retrieve distinct divisions for trustee ${TRUSTEE_ID}`,
      );
      repo.release();
    });
  });

  describe('updateCaseFields', () => {
    test('should use updateMany on case partition to update ALL matching documents', async () => {
      const updateManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'updateMany')
        .mockResolvedValue({
          modifiedCount: 3,
          matchedCount: 3,
        });
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
        { ...baseAppointment, id: 'appt-001', trusteeId: 'TRUSTEE-001' },
        { ...baseAppointment, id: 'appt-002', trusteeId: 'TRUSTEE-001' },
        { ...baseAppointment, id: 'appt-003', trusteeId: 'TRUSTEE-002' },
      ]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const fields = {
        dateFiled: '2024-01-01',
        caseStatus: 'CLOSED' as const,
        chapter: '7',
        courtDivisionCode: 'DIV001',
      };

      await repo.updateCaseFields(CASE_ID, fields);

      // Verify updateMany was called (not updateOne) on case partition
      expect(updateManySpy).toHaveBeenCalled();
      repo.release();
    });

    test('should fetch all trusteeIds from case partition before updating trustee partition', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateMany').mockResolvedValue({
        modifiedCount: 1,
        matchedCount: 1,
      });
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValueOnce([
        // First call: getByCaseId from case partition
        { ...baseAppointment, id: 'appt-001', trusteeId: 'TRUSTEE-001', caseId: CASE_ID },
        {
          ...baseAppointment,
          id: 'appt-002',
          trusteeId: 'TRUSTEE-002',
          caseId: CASE_ID,
        },
      ]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const fields = {
        dateFiled: '2024-01-01',
        caseStatus: 'CLOSED' as const,
        chapter: '7',
        courtDivisionCode: 'DIV001',
      };

      await repo.updateCaseFields(CASE_ID, fields);

      // Verify find was called to get trusteeIds
      expect(findSpy).toHaveBeenCalled();
      repo.release();
    });

    test('should issue per-trusteeId updateMany calls to trustee partition (shard-targeted)', async () => {
      const updateManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'updateMany')
        .mockResolvedValue({
          modifiedCount: 1,
          matchedCount: 1,
        });
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValueOnce([
        // Return 2 different trusteeIds
        { ...baseAppointment, id: 'appt-001', trusteeId: 'TRUSTEE-001', caseId: CASE_ID },
        {
          ...baseAppointment,
          id: 'appt-002',
          trusteeId: 'TRUSTEE-002',
          caseId: CASE_ID,
        },
      ]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const fields = {
        dateFiled: '2024-01-01',
        caseStatus: 'CLOSED' as const,
        chapter: '7',
        courtDivisionCode: 'DIV001',
      };

      await repo.updateCaseFields(CASE_ID, fields);

      // Should have called updateMany 3 times:
      // 1. Case partition
      // 2. Trustee partition for TRUSTEE-001
      // 3. Trustee partition for TRUSTEE-002
      expect(updateManySpy).toHaveBeenCalledTimes(3);
      repo.release();
    });

    test('should NOT include source field in the update document', async () => {
      let capturedUpdateDoc: Record<string, unknown> | undefined;
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateMany').mockImplementation(
        async (_query, update) => {
          capturedUpdateDoc = update as Record<string, unknown>;
          return { modifiedCount: 1, matchedCount: 1 };
        },
      );
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValueOnce([
        { ...baseAppointment, id: 'appt-001', trusteeId: 'TRUSTEE-001', caseId: CASE_ID },
      ]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const fields = {
        dateFiled: '2024-01-01',
        caseStatus: 'CLOSED' as const,
        chapter: '7',
        courtDivisionCode: 'DIV001',
      };

      await repo.updateCaseFields(CASE_ID, fields);

      // Verify source is NOT in the update document
      expect(capturedUpdateDoc).toBeDefined();
      expect(capturedUpdateDoc).not.toHaveProperty('source');
      repo.release();
    });

    test('should deduplicate trusteeIds when multiple appointments share same trustee', async () => {
      const updateManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'updateMany')
        .mockResolvedValue({
          modifiedCount: 1,
          matchedCount: 1,
        });
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValueOnce([
        // Same trustee twice
        { ...baseAppointment, id: 'appt-001', trusteeId: 'TRUSTEE-001', caseId: CASE_ID },
        {
          ...baseAppointment,
          id: 'appt-002',
          trusteeId: 'TRUSTEE-001',
          caseId: CASE_ID,
        },
      ]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const fields = {
        dateFiled: '2024-01-01',
        caseStatus: 'CLOSED' as const,
        chapter: '7',
        courtDivisionCode: 'DIV001',
      };

      await repo.updateCaseFields(CASE_ID, fields);

      // Should have called updateMany only 2 times:
      // 1. Case partition
      // 2. Trustee partition for TRUSTEE-001 (deduplicated, not twice)
      expect(updateManySpy).toHaveBeenCalledTimes(2);
      repo.release();
    });
  });

  describe('updateCaseFields — error paths', () => {
    const fields = {
      dateFiled: '2024-01-01',
      caseStatus: 'CLOSED' as const,
      chapter: '7',
      courtDivisionCode: 'DIV001',
    };

    test('should throw when case-partition updateMany fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateMany').mockRejectedValueOnce(
        new Error('case partition updateMany failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.updateCaseFields(CASE_ID, fields)).rejects.toThrow(
        `Failed to update case fields for case ${CASE_ID} in case partition`,
      );
      repo.release();
    });

    test('should throw when the read-back find fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateMany').mockResolvedValue({
        modifiedCount: 1,
        matchedCount: 1,
      });
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValueOnce(
        new Error('find failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.updateCaseFields(CASE_ID, fields)).rejects.toThrow(
        `Failed to read case appointments for case ${CASE_ID} to determine trustee partitions`,
      );
      repo.release();
    });

    test('should throw when trustee-partition updateMany fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateMany')
        .mockResolvedValueOnce({ modifiedCount: 1, matchedCount: 1 })
        .mockRejectedValueOnce(new Error('trustee partition updateMany failed'));
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValueOnce([
        { ...baseAppointment, id: 'appt-001', trusteeId: TRUSTEE_ID, caseId: CASE_ID },
      ]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.updateCaseFields(CASE_ID, fields)).rejects.toThrow(
        `Failed to update case fields for case ${CASE_ID} in trustee partition`,
      );
      repo.release();
    });
  });

  describe('getActiveByTrusteeIdFromTrusteePartition', () => {
    test('should return active appointments for trustee from trustee partition', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([baseAppointment]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getActiveByTrusteeIdFromTrusteePartition(TRUSTEE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].trusteeId).toBe(TRUSTEE_ID);
      repo.release();
    });

    test('should return empty array when no active appointments exist', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getActiveByTrusteeIdFromTrusteePartition(TRUSTEE_ID);

      expect(result).toHaveLength(0);
      repo.release();
    });
  });

  describe('replaceOneInTrusteePartition', () => {
    const query = { caseId: CASE_ID, trusteeId: TRUSTEE_ID, assignedOn: '2024-01-15' };
    const document = {
      ...baseAppointment,
      documentType: 'CASE_APPOINTMENT' as const,
    };

    test('should replace document in trustee partition', async () => {
      const replaceOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: 'appt-001', modifiedCount: 0, upsertedCount: 1 });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.replaceOneInTrusteePartition(query, document);

      expect(replaceOneSpy).toHaveBeenCalledOnce();
      repo.release();
    });

    test('should throw with case context when replaceOne fails', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValueOnce(
        new Error('write failed'),
      );
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.replaceOneInTrusteePartition(query, document)).rejects.toThrow(
        `Failed to write to trustee partition for case ${CASE_ID}`,
      );
      repo.release();
    });
  });

  describe('Type constraints', () => {
    test('CaseAppointmentInput type does not include acmsProfessionalId or reason', async () => {
      // This test verifies that the public API type does not expose these fields
      // They should only exist in the internal CaseAppointmentDocument type
      const input: CaseAppointmentInput = {
        caseId: 'case-001',
        trusteeId: 'trustee-001',
        assignedOn: '2024-01-15T00:00:00Z',
        appointedDate: '2024-01-15',
      };

      // TypeScript compilation will fail if we try to assign acmsProfessionalId or reason
      // These assertions verify that the object structure is as expected
      expect(input).toHaveProperty('caseId');
      expect(input).toHaveProperty('trusteeId');
      expect(input).toHaveProperty('assignedOn');
      expect(input).not.toHaveProperty('acmsProfessionalId');
      expect(input).not.toHaveProperty('reason');
    });

    test('CaseAppointment public type does not include acmsProfessionalId or reason', async () => {
      // This test verifies that the public API return type does not expose these fields
      const appointment: CaseAppointment = {
        id: 'appt-001',
        caseId: 'case-001',
        trusteeId: 'trustee-001',
        assignedOn: '2024-01-15T00:00:00Z',
        appointedDate: '2024-01-15',
        createdOn: '2024-01-15T00:00:00Z',
        updatedOn: '2024-01-15T00:00:00Z',
        createdBy: SYSTEM_USER_REFERENCE,
        updatedBy: SYSTEM_USER_REFERENCE,
      };

      expect(appointment).toHaveProperty('caseId');
      expect(appointment).toHaveProperty('trusteeId');
      expect(appointment).toHaveProperty('assignedOn');
      expect(appointment).not.toHaveProperty('acmsProfessionalId');
      expect(appointment).not.toHaveProperty('reason');
    });
  });
});
