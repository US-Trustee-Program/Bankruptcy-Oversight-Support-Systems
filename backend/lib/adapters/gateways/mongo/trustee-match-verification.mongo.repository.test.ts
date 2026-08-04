import { vi, describe, test, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { TrusteeMatchVerificationMongoRepository } from './trustee-match-verification.mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { NotFoundError } from '../../../common-errors/not-found-error';
import QueryBuilder from '../../../query/query-builder';

describe('TrusteeMatchVerificationMongoRepository', () => {
  let context: ApplicationContext;
  let repository: TrusteeMatchVerificationMongoRepository;

  const sampleVerification: TrusteeMatchVerification = {
    id: 'verification-1',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: 'case-001',
    courtId: '081',
    dxtrTrustee: { fullName: 'John Doe' },
    mismatchReason: 'IMPERFECT_MATCH',
    matchCandidates: [],
    taskType: 'trustee-match',
    status: 'pending',
    createdOn: '2025-01-01T00:00:00.000Z',
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    taskDate: '2025-01-01T00:00:00.000Z',
    fingerprint: 'fp-abc123',
    variant: '{"firstName":"john","lastName":"doe"}',
  };

  const expectedQueryForCase001 = {
    conjunction: 'AND',
    values: [
      {
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE_MATCH_VERIFICATION',
      },
      {
        condition: 'EQUALS',
        leftOperand: { name: 'caseId' },
        rightOperand: 'case-001',
      },
    ],
  };

  const expectedQueryForFingerprint = {
    conjunction: 'AND',
    values: [
      {
        condition: 'EQUALS',
        leftOperand: { name: 'documentType' },
        rightOperand: 'TRUSTEE_MATCH_VERIFICATION',
      },
      {
        condition: 'EQUALS',
        leftOperand: { name: 'fingerprint' },
        rightOperand: 'fp-abc123',
      },
      {
        condition: 'EQUALS',
        leftOperand: { name: 'variant' },
        rightOperand: '{"firstName":"john","lastName":"doe"}',
      },
    ],
  };

  beforeEach(async () => {
    vi.stubEnv('MONGO_CONNECTION_STRING', 'mongodb://localhost:27017');
    context = await createMockApplicationContext();
    repository = new TrusteeMatchVerificationMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.unstubAllEnvs();
    repository.release();
  });

  afterAll(() => {
    TrusteeMatchVerificationMongoRepository.dropInstance();
  });

  describe('getInstance and dropInstance', () => {
    test('should manage reference count correctly', async () => {
      const instance1 = TrusteeMatchVerificationMongoRepository.getInstance(context);
      const instance2 = TrusteeMatchVerificationMongoRepository.getInstance(context);
      const instance3 = TrusteeMatchVerificationMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);

      instance1.release();
      instance2.release();

      const instance4 = TrusteeMatchVerificationMongoRepository.getInstance(context);
      expect(instance4).toBe(instance1);

      instance3.release();
      instance4.release();
    });
  });

  describe('getVerification', () => {
    test('should return the document when found', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(sampleVerification);

      const result = await repository.getVerification('case-001');

      expect(result).toEqual(sampleVerification);
      expect(MongoCollectionAdapter.prototype.findOne).toHaveBeenCalledWith(
        expectedQueryForCase001,
      );
    });

    test('should return null when document does not exist', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new NotFoundError('MONGO', { message: 'Not found' }),
      );

      const result = await repository.getVerification('case-001');

      expect(result).toBeNull();
    });

    test('should wrap unexpected errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(repository.getVerification('case-001')).rejects.toThrow(
        'Failed to retrieve trustee match verification for case case-001.',
      );
    });
  });

  describe('findByFingerprint', () => {
    test('returns an empty array when the bucket has no members', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repository.findByFingerprint('fp-empty');

      expect(result).toEqual([]);
    });

    test('returns the single matching document', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([sampleVerification]);

      const result = await repository.findByFingerprint('fp-abc123');

      expect(result).toEqual([sampleVerification]);
      expect(MongoCollectionAdapter.prototype.find).toHaveBeenCalledWith(
        expect.objectContaining({
          conjunction: 'AND',
          values: expect.arrayContaining([
            expect.objectContaining({
              condition: 'EQUALS',
              leftOperand: { name: 'fingerprint' },
              rightOperand: 'fp-abc123',
            }),
          ]),
        }),
      );
    });

    test('returns every document sharing the fingerprint bucket, without filtering by variant', async () => {
      const otherVariant: TrusteeMatchVerification = {
        ...sampleVerification,
        id: 'verification-2',
        variant: '{"firstName":"jane","lastName":"doe"}',
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
        sampleVerification,
        otherVariant,
      ]);

      const result = await repository.findByFingerprint('fp-abc123');

      expect(result).toEqual([sampleVerification, otherVariant]);
    });

    test('should wrap unexpected errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(repository.findByFingerprint('fp-abc123')).rejects.toThrow(
        'Failed to find trustee match verifications for fingerprint fp-abc123.',
      );
    });
  });

  describe('findById', () => {
    test('should return the document when found by id', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(sampleVerification);

      const result = await repository.findById('verification-1');

      expect(result).toEqual(sampleVerification);
    });

    test('should re-throw NotFoundError when document does not exist', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new NotFoundError('MONGO', { message: 'Not found' }),
      );

      await expect(repository.findById('missing-id')).rejects.toThrow(NotFoundError);
    });

    test('should wrap unexpected errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(repository.findById('verification-1')).rejects.toThrow(
        'Failed to find trustee match verification verification-1.',
      );
    });
  });

  describe('update', () => {
    test('should merge partial updates, persist, and return the merged document', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockResolvedValue(sampleVerification);
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockResolvedValue({
        id: 'verification-1',
        modifiedCount: 1,
        upsertedCount: 0,
      });

      const result = await repository.update('verification-1', { status: 'approved' });

      expect(result).toEqual({ ...sampleVerification, status: 'approved' });
      expect(MongoCollectionAdapter.prototype.replaceOne).toHaveBeenCalledWith(
        expect.objectContaining({ conjunction: 'AND' }),
        { ...sampleVerification, status: 'approved' },
      );
    });

    test('should re-throw NotFoundError when document does not exist', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new NotFoundError('MONGO', { message: 'Not found' }),
      );

      await expect(repository.update('missing-id', { status: 'approved' })).rejects.toThrow(
        NotFoundError,
      );
    });

    test('should wrap unexpected errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'findOne').mockRejectedValue(
        new Error('Database failure'),
      );

      await expect(repository.update('verification-1', { status: 'approved' })).rejects.toThrow(
        'Failed to update trustee match verification verification-1.',
      );
    });
  });

  describe('search', () => {
    test('should return documents sorted by taskDate ascending with projection', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([sampleVerification]);

      const result = await repository.search({ status: ['pending'] });

      expect(result).toEqual([sampleVerification]);
      expect(MongoCollectionAdapter.prototype.find).toHaveBeenCalledWith(
        expect.objectContaining({ conjunction: 'AND' }),
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({ field: { name: 'taskDate' }, direction: 'ASCENDING' }),
          ]),
        }),
        undefined,
        expect.objectContaining({
          mode: 'INCLUDE',
          fields: expect.arrayContaining([
            'id',
            'documentType',
            'caseId',
            'courtId',
            'courtName',
            'dxtrTrustee',
            'mismatchReason',
            'matchCandidates',
            'status',
            'resolvedTrusteeId',
            'resolvedTrusteeName',
            'taskType',
            'taskDate',
            'reason',
            'inactiveAppointmentStatus',
            'fingerprint',
            'variant',
          ]),
        }),
      );
    });

    test('should wrap errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new Error('Database failure'),
      );

      await expect(repository.search({ status: ['pending'] })).rejects.toThrow(
        'Failed to find trustee match verification records.',
      );
    });
  });

  describe('upsertVerification', () => {
    test('should call replaceOne keyed by fingerprint/variant, not caseId, with upsert = true', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockResolvedValue({
        id: 'verification-1',
        modifiedCount: 1,
        upsertedCount: 0,
      });

      await repository.upsertVerification(sampleVerification);

      expect(MongoCollectionAdapter.prototype.replaceOne).toHaveBeenCalledWith(
        expectedQueryForFingerprint,
        sampleVerification,
        true,
      );
      const callArg = (MongoCollectionAdapter.prototype.replaceOne as ReturnType<typeof vi.spyOn>)
        .mock.calls[0][0];
      expect(JSON.stringify(callArg)).not.toContain('caseId');
    });

    test('a second fingerprint for the same caseId targets its own document, not the first', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockResolvedValue({
        id: 'verification-2',
        modifiedCount: 0,
        upsertedCount: 1,
      });

      const secondFingerprintDoc: TrusteeMatchVerification = {
        ...sampleVerification,
        id: 'verification-2',
        fingerprint: 'fp-different',
        variant: '{"firstName":"jane","lastName":"doe"}',
      };

      await repository.upsertVerification(secondFingerprintDoc);

      expect(MongoCollectionAdapter.prototype.replaceOne).toHaveBeenCalledWith(
        expect.objectContaining({
          conjunction: 'AND',
          values: expect.arrayContaining([
            expect.objectContaining({
              condition: 'EQUALS',
              leftOperand: { name: 'fingerprint' },
              rightOperand: 'fp-different',
            }),
          ]),
        }),
        secondFingerprintDoc,
        true,
      );
    });

    test('resolves as a no-op when the write rejects with a duplicate-key error', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error(
          'Failed to replace item. E11000 duplicate key error collection: cams.trustee-match-verification index: fingerprint_variant_documentType dup key: { : "fp-abc123" }',
        ),
      );

      await expect(repository.upsertVerification(sampleVerification)).resolves.toBeUndefined();
    });

    test('should still wrap and throw non-duplicate-key errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error('Write failed'),
      );

      await expect(repository.upsertVerification(sampleVerification)).rejects.toThrow(
        'Failed to upsert trustee match verification for fingerprint fp-abc123.',
      );
    });
  });

  describe('findVerificationsMissingTaskDate', () => {
    test('should call find with documentType and taskDate notExists conditions, no lastId', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([sampleVerification]);

      const result = await repository.findVerificationsMissingTaskDate(null, 10);

      expect(result).toEqual([sampleVerification]);
      expect(MongoCollectionAdapter.prototype.find).toHaveBeenCalledWith(
        expect.objectContaining({ conjunction: 'AND' }),
        expect.objectContaining({
          fields: expect.arrayContaining([expect.objectContaining({ direction: 'ASCENDING' })]),
        }),
        10,
      );
    });

    test('should include _id greaterThan condition when lastId is provided', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      await repository.findVerificationsMissingTaskDate('last-mongo-id', 5);

      const callArg = (MongoCollectionAdapter.prototype.find as ReturnType<typeof vi.spyOn>).mock
        .calls[0][0];
      const queryStr = JSON.stringify(callArg);
      expect(queryStr).toContain('last-mongo-id');
    });

    test('should wrap errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new Error('Database failure'),
      );

      await expect(repository.findVerificationsMissingTaskDate(null, 10)).rejects.toThrow(
        'Failed to find trustee match verifications missing taskDate.',
      );
    });
  });

  describe('updateVerificationTaskDate', () => {
    test('should call updateOne with _id query and taskDate update', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateOne').mockResolvedValue(undefined);

      await repository.updateVerificationTaskDate('mongo-id-123', '2025-06-01T00:00:00.000Z');

      expect(MongoCollectionAdapter.prototype.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ condition: 'EQUALS' }),
        expect.objectContaining({ taskDate: '2025-06-01T00:00:00.000Z' }),
      );
    });

    test('should wrap errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateOne').mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(
        repository.updateVerificationTaskDate('mongo-id-123', '2025-06-01T00:00:00.000Z'),
      ).rejects.toThrow('Failed to update taskDate on trustee match verification mongo-id-123.');
    });
  });

  describe('updateManyByQuery', () => {
    test('should call updateMany and return the result', async () => {
      const updateResult = { modifiedCount: 3, upsertedCount: 0, matchedCount: 3 };
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateMany').mockResolvedValue(updateResult);

      const { using, and } = QueryBuilder;
      const doc = using<TrusteeMatchVerification>();
      const query = and(doc('status').equals('pending'));

      const result = await repository.updateManyByQuery(query, {
        taskDate: '2025-06-01T00:00:00.000Z',
      });

      expect(result).toEqual(updateResult);
      expect(MongoCollectionAdapter.prototype.updateMany).toHaveBeenCalledWith(query, {
        taskDate: '2025-06-01T00:00:00.000Z',
      });
    });

    test('should wrap errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'updateMany').mockRejectedValue(
        new Error('Bulk update failed'),
      );

      const { using } = QueryBuilder;
      const doc = using<TrusteeMatchVerification>();
      const query = doc('status').equals('pending');

      await expect(
        repository.updateManyByQuery(query, { taskDate: '2025-06-01T00:00:00.000Z' }),
      ).rejects.toThrow('Failed to bulk-update trustee match verification documents.');
    });
  });
});
