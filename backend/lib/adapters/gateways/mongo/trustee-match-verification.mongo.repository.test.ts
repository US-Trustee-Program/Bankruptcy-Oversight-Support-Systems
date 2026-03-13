import { vi, describe, test, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { TrusteeMatchVerificationMongoRepository } from './trustee-match-verification.mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { NotFoundError } from '../../../common-errors/not-found-error';

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
    orderType: 'trustee-match-verification',
    status: 'pending',
    createdOn: '2025-01-01T00:00:00.000Z',
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
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

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repository = new TrusteeMatchVerificationMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
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

  describe('upsertVerification', () => {
    test('should call replaceOne with upsert = true', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockResolvedValue({
        id: 'verification-1',
        modifiedCount: 1,
        upsertedCount: 0,
      });

      await repository.upsertVerification(sampleVerification);

      expect(MongoCollectionAdapter.prototype.replaceOne).toHaveBeenCalledWith(
        expectedQueryForCase001,
        sampleVerification,
        true,
      );
    });

    test('should wrap errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(
        new Error('Write failed'),
      );

      await expect(repository.upsertVerification(sampleVerification)).rejects.toThrow(
        'Failed to upsert trustee match verification for case case-001.',
      );
    });
  });
});
