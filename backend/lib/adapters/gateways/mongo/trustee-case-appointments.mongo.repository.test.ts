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
        source: 'acms',
      };

      await repo.upsert(input);

      // Verify the query passed to replaceOne does NOT include source condition
      const firstCallQuery = replaceOneSpy.mock.calls[0][0];
      expect(firstCallQuery).toBeDefined();

      // Check that natural key has exactly 4 conditions (not 5 with source)
      // The query object should have values array with 4 items for the 4-field key
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        source: 'acms',
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

    test('case with no closedDate — returns caseStatus OPEN', async () => {
      mockAggregateCursor({ metadata: [{ total: 1 }], data: [baseItem] });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data[0].caseStatus).toBe('OPEN');
      repo.release();
    });

    test('case with closedDate and no reopenedDate — returns caseStatus CLOSED', async () => {
      mockAggregateCursor({
        metadata: [{ total: 1 }],
        data: [{ ...baseItem, closedDate: '2024-06-01' }],
      });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data[0].caseStatus).toBe('CLOSED');
      repo.release();
    });

    test('case with closedDate and an earlier reopenedDate — returns caseStatus CLOSED', async () => {
      mockAggregateCursor({
        metadata: [{ total: 1 }],
        data: [{ ...baseItem, closedDate: '2024-06-01', reopenedDate: '2024-03-01' }],
      });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data[0].caseStatus).toBe('CLOSED');
      repo.release();
    });

    test('case with closedDate and a later reopenedDate — returns caseStatus OPEN', async () => {
      mockAggregateCursor({
        metadata: [{ total: 1 }],
        data: [{ ...baseItem, closedDate: '2024-03-01', reopenedDate: '2024-06-01' }],
      });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data[0].caseStatus).toBe('OPEN');
      repo.release();
    });

    test('returned item does not leak closedDate or reopenedDate', async () => {
      mockAggregateCursor({
        metadata: [{ total: 1 }],
        data: [{ ...baseItem, closedDate: '2024-06-01', reopenedDate: '2024-03-01' }],
      });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const result = await repo.getCasesForTrustee(TRUSTEE_ID, basePredicate);

      expect(result.data[0]).not.toHaveProperty('closedDate');
      expect(result.data[0]).not.toHaveProperty('reopenedDate');
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

    test('in-memory sort limit — raw mongo error with sort limit message — logs trusteeId and rethrows', async () => {
      // The adapter wraps Mongo errors; simulating the raw error surfacing the sort limit text.
      const sortLimitError = new Error(
        '$sort exceeded memory limit of 104857600 bytes, but did not opt in to external sorting',
      );
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockRejectedValue(sortLimitError);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.getCasesForTrustee(TRUSTEE_ID, basePredicate)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(TRUSTEE_ID),
      );
      consoleSpy.mockRestore();
      repo.release();
    });

    test('non-sort-limit error — does not log sort limit warning', async () => {
      vi.spyOn(CollectionHumble.prototype, 'aggregate').mockRejectedValue(
        new Error('some unrelated mongo error'),
      );
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await expect(repo.getCasesForTrustee(TRUSTEE_ID, basePredicate)).rejects.toThrow();

      const sortLimitCalls = consoleSpy.mock.calls.filter((args) =>
        String(args[1]).includes('$sort exceeded'),
      );
      expect(sortLimitCalls).toHaveLength(0);
      consoleSpy.mockRestore();
      repo.release();
    });
  });

  describe('updateCaseFields', () => {
    test('should write $set with denormalized fields and source to case partition', async () => {
      const updateOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({
          modifiedCount: 1,
          matchedCount: 1,
        });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const fields = {
        dateFiled: '2024-01-01',
        caseStatus: 'CLOSED' as const,
        chapter: '7',
        courtDivisionCode: 'DIV001',
      };

      await repo.updateCaseFields(CASE_ID, fields);

      expect(updateOneSpy).toHaveBeenCalled();
      repo.release();
    });

    test('should write $set to trustee partition', async () => {
      const updateOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'updateOne')
        .mockResolvedValue({
          modifiedCount: 1,
          matchedCount: 1,
        });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const fields = {
        dateFiled: '2024-01-01',
        caseStatus: 'CLOSED' as const,
        chapter: '7',
        courtDivisionCode: 'DIV001',
      };

      await repo.updateCaseFields(CASE_ID, fields);

      // Should be called twice: once for case partition, once for trustee partition
      expect(updateOneSpy).toHaveBeenCalledTimes(2);
      repo.release();
    });

    test('should throw on trustee partition failure (hard-fail pattern)', async () => {
      const updateOneSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'updateOne');
      // First call succeeds, second call fails
      updateOneSpy.mockResolvedValueOnce({
        modifiedCount: 1,
        matchedCount: 1,
      });
      updateOneSpy.mockRejectedValueOnce(new Error('Trustee partition write failed'));

      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const fields = {
        dateFiled: '2024-01-01',
        caseStatus: 'CLOSED' as const,
        chapter: '7',
        courtDivisionCode: 'DIV001',
      };

      await expect(repo.updateCaseFields(CASE_ID, fields)).rejects.toThrow(
        /Failed to update case fields.*trustee partition/,
      );
      repo.release();
    });
  });

  describe('countActiveMissingDateFiled', () => {
    test('returns count of active appointments missing dateFiled', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
        { id: 'a1' },
        { id: 'a2' },
        { id: 'a3' },
      ]);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const count = await repo.countActiveMissingDateFiled();

      expect(count).toBe(3);
      repo.release();
    });
  });

  describe('checkIndexExists', () => {
    function mockListIndexes(indexNames: string[]) {
      const mockCursor = {
        toArray: vi.fn().mockResolvedValue(indexNames.map((name) => ({ name }))),
      };
      vi.spyOn(CollectionHumble.prototype, 'listIndexes').mockReturnValue(mockCursor as never);
    }

    test('returns true when named index exists in collection', async () => {
      mockListIndexes(['_id_', 'trusteeId_1_unassignedOn_1_dateFiled_1_caseStatus_1']);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const exists = await repo.checkIndexExists(
        'trusteeId_1_unassignedOn_1_dateFiled_1_caseStatus_1',
      );

      expect(exists).toBe(true);
      repo.release();
    });

    test('returns false when named index does not exist in collection', async () => {
      mockListIndexes(['_id_', 'trusteeId_1_unassignedOn_1']);
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      const exists = await repo.checkIndexExists(
        'trusteeId_1_unassignedOn_1_dateFiled_1_caseStatus_1',
      );

      expect(exists).toBe(false);
      repo.release();
    });
  });

  describe('createCompoundIndex', () => {
    test('creates (trusteeId, unassignedOn, dateFiled, caseStatus) index on trustee collection', async () => {
      const createIndexSpy = vi
        .spyOn(CollectionHumble.prototype, 'createIndex')
        .mockResolvedValue('trusteeId_1_unassignedOn_1_dateFiled_1_caseStatus_1');
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.createCompoundIndex();

      expect(createIndexSpy).toHaveBeenCalledWith({
        trusteeId: 1,
        unassignedOn: 1,
        dateFiled: 1,
        caseStatus: 1,
      });
      repo.release();
    });
  });

  describe('dropIndex', () => {
    test('drops the named index from the trustee collection', async () => {
      const dropIndexSpy = vi
        .spyOn(CollectionHumble.prototype, 'dropIndex')
        .mockResolvedValue({ ok: 1 });
      const context = await createMockApplicationContext();
      const repo = TrusteeCaseAppointmentsMongoRepository.getInstance(context);

      await repo.dropIndex('trusteeId_1_unassignedOn_1');

      expect(dropIndexSpy).toHaveBeenCalledWith('trusteeId_1_unassignedOn_1');
      repo.release();
    });
  });
});
