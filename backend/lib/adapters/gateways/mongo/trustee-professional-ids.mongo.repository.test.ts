import { vi, beforeEach, afterEach, afterAll, describe, test, expect } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import {
  TrusteeProfessionalIdsMongoRepository,
  TrusteeProfessionalIdDocument,
} from './trustee-professional-ids.mongo.repository';
import { TrusteeProfessionalId } from '../../../use-cases/dataflows/trustee-professional-ids.types';
import { CamsUserReference } from '@common/cams/users';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';

describe('TrusteeProfessionalIdsMongoRepository', () => {
  let context: ApplicationContext;
  let repository: TrusteeProfessionalIdsMongoRepository;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleProfessionalId: TrusteeProfessionalId = {
    id: 'prof-id-1',
    camsTrusteeId: 'trustee-1',
    acmsProfessionalId: 'NY-00063',
    documentType: 'TRUSTEE_PROFESSIONAL_ID',
    disposition: 'auto-linked',
    evidence: {
      sourceRaw: { fullName: 'John Doe' },
      sourceNormalized: {},
      memo: {},
      candidates: [],
      match: { trusteeId: 'trustee-1', score: {} },
      skip: false,
      error: null,
    },
    createdOn: '2024-01-15T10:00:00Z',
    createdBy: mockUser,
    updatedOn: '2024-01-15T10:00:00Z',
    updatedBy: mockUser,
  };

  const isRealLinkCondition = {
    condition: 'EQUALS',
    leftOperand: { name: 'disposition' },
    rightOperand: 'auto-linked',
  };

  function withoutAuditOrId(
    document: TrusteeProfessionalId,
  ): Omit<TrusteeProfessionalId, 'id' | 'createdOn' | 'createdBy' | 'updatedOn' | 'updatedBy'> {
    const {
      id: _id,
      createdOn: _createdOn,
      createdBy: _createdBy,
      updatedOn: _updatedOn,
      updatedBy: _updatedBy,
      ...rest
    } = document;
    return rest;
  }

  beforeEach(async () => {
    process.env.MONGO_CONNECTION_STRING = 'mongodb://localhost:27017';
    context = await createMockApplicationContext();
    repository = TrusteeProfessionalIdsMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repository.release();
  });

  afterAll(() => {
    TrusteeProfessionalIdsMongoRepository.dropInstance();
  });

  describe('getInstance and dropInstance', () => {
    test('should return the same instance on multiple calls', async () => {
      const instance1 = TrusteeProfessionalIdsMongoRepository.getInstance(context);
      const instance2 = TrusteeProfessionalIdsMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);

      // Clean up
      instance1.release();
      instance2.release();
    });

    test('should manage reference count correctly', async () => {
      // Get multiple instances to increase reference count
      const instance1 = TrusteeProfessionalIdsMongoRepository.getInstance(context);
      const instance2 = TrusteeProfessionalIdsMongoRepository.getInstance(context);
      const instance3 = TrusteeProfessionalIdsMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);

      // First two releases should decrement count but keep instance
      instance1.release();
      instance2.release();

      // Instance should still exist
      const instance4 = TrusteeProfessionalIdsMongoRepository.getInstance(context);
      expect(instance4).toBe(instance1);

      // Clean up remaining references
      instance3.release();
      instance4.release();
    });
  });

  describe('upsertProfessionalId', () => {
    const camsTrusteeId = 'trustee-123';
    const acmsProfessionalId = 'NY-00063';

    test('should write an auto-linked professional ID mapping successfully', async () => {
      const insertOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('new-prof-id');

      const document = withoutAuditOrId({
        ...sampleProfessionalId,
        camsTrusteeId,
        acmsProfessionalId,
      });
      const result = await repository.upsertProfessionalId(document, mockUser);

      expect(insertOneSpy).toHaveBeenCalled();
      expect(result.id).toBe('new-prof-id');
      expect(result.camsTrusteeId).toBe(camsTrusteeId);
      expect(result.acmsProfessionalId).toBe(acmsProfessionalId);
      expect(result.documentType).toBe('TRUSTEE_PROFESSIONAL_ID');
    });

    test('should write a no-match placeholder record keyed by fingerprint', async () => {
      const insertOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('errored-prof-id');

      const document = withoutAuditOrId({
        ...sampleProfessionalId,
        camsTrusteeId: 'the-fingerprint',
        acmsProfessionalId,
        disposition: 'no-match',
        evidence: { ...sampleProfessionalId.evidence, variant: 'the-variant-string', match: null },
      });
      const result = await repository.upsertProfessionalId(document, mockUser);

      expect(insertOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          camsTrusteeId: 'the-fingerprint',
          acmsProfessionalId,
          disposition: 'no-match',
          evidence: expect.objectContaining({ variant: 'the-variant-string' }),
        }),
      );
      expect(result.id).toBe('errored-prof-id');
      expect(result.camsTrusteeId).toBe('the-fingerprint');
      expect(result.disposition).toBe('no-match');
    });

    test('should allow the same ACMS ID mapped to a different trustee (many-to-one)', async () => {
      const differentTrusteeId = 'different-trustee-456';

      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('new-prof-id-2');

      const document = withoutAuditOrId({
        ...sampleProfessionalId,
        camsTrusteeId: differentTrusteeId,
        acmsProfessionalId,
        evidence: {
          ...sampleProfessionalId.evidence,
          match: { trusteeId: differentTrusteeId, score: {} },
        },
      });
      const result = await repository.upsertProfessionalId(document, mockUser);

      expect(result.camsTrusteeId).toBe(differentTrusteeId);
      expect(result.acmsProfessionalId).toBe(acmsProfessionalId);
    });

    test('should handle database errors during creation', async () => {
      const error = new Error('Database connection failed');
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);

      const document = withoutAuditOrId({
        ...sampleProfessionalId,
        camsTrusteeId,
        acmsProfessionalId,
      });

      await expect(repository.upsertProfessionalId(document, mockUser)).rejects.toThrow(
        `Failed to write professional ID record for trustee ${camsTrusteeId} and ACMS ID ${acmsProfessionalId}.`,
      );
    });

    test('should not check for an existing record before inserting (always attempts a fresh insert)', async () => {
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find');
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('errored-prof-id');

      const document = withoutAuditOrId({
        ...sampleProfessionalId,
        camsTrusteeId: 'the-fingerprint',
        acmsProfessionalId,
        disposition: 'ambiguous',
        evidence: { ...sampleProfessionalId.evidence, match: null },
      });
      await repository.upsertProfessionalId(document, mockUser);

      expect(findSpy).not.toHaveBeenCalled();
    });

    test('should return the existing document and warn when a retry replays an already-written record', async () => {
      // handlePage retries an entire page from its original bookmark on a transient error, so a
      // record already written earlier in the same invocation gets reprocessed and hits the
      // (camsTrusteeId, acmsProfessionalId, documentType) unique index a second time - not a race
      // between two different callers.
      const duplicateKeyError = new Error(
        'E11000 duplicate key error collection: trustee-professional-ids index: camsTrusteeId_1_acmsProfessionalId_1_documentType_1',
      );
      const existingDocument: TrusteeProfessionalIdDocument = {
        ...sampleProfessionalId,
        id: 'errored-prof-id',
        camsTrusteeId: 'the-fingerprint',
        acmsProfessionalId,
        disposition: 'no-match',
        evidence: { ...sampleProfessionalId.evidence, variant: 'the-variant-string', match: null },
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(duplicateKeyError);
      const findSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue([existingDocument]);
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const document = withoutAuditOrId({
        ...sampleProfessionalId,
        camsTrusteeId: 'the-fingerprint',
        acmsProfessionalId,
        disposition: 'no-match',
        evidence: { ...sampleProfessionalId.evidence, variant: 'the-variant-string', match: null },
      });
      const result = await repository.upsertProfessionalId(document, mockUser);

      expect(result).toEqual(existingDocument);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.arrayContaining([
            expect.objectContaining({ rightOperand: 'the-fingerprint' }),
            expect.objectContaining({ rightOperand: acmsProfessionalId }),
          ]),
        }),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining(acmsProfessionalId),
      );
    });

    test('should still throw when a duplicate-key error is caught but no matching document is found', async () => {
      const duplicateKeyError = new Error('E11000 duplicate key error');
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(duplicateKeyError);
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const document = withoutAuditOrId({
        ...sampleProfessionalId,
        camsTrusteeId: 'the-fingerprint',
        acmsProfessionalId,
        disposition: 'no-match',
        evidence: { ...sampleProfessionalId.evidence, match: null },
      });

      await expect(repository.upsertProfessionalId(document, mockUser)).rejects.toThrow(
        `Failed to write professional ID record for trustee the-fingerprint and ACMS ID ${acmsProfessionalId}.`,
      );
    });
  });

  describe('findByCamsTrusteeId', () => {
    const camsTrusteeId = 'trustee-1';
    const expectedQuery = {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'camsTrusteeId' },
          rightOperand: camsTrusteeId,
        },
        isRealLinkCondition,
      ],
    };

    test('should find all professional IDs for a trustee', async () => {
      // Test scenario: Harvey Barr has multiple ACMS IDs (NY-00063, UT-05321)
      const mockProfessionalIds: TrusteeProfessionalIdDocument[] = [
        {
          ...sampleProfessionalId,
          id: 'prof-id-1',
          camsTrusteeId,
          acmsProfessionalId: 'NY-00063',
        },
        {
          ...sampleProfessionalId,
          id: 'prof-id-2',
          camsTrusteeId,
          acmsProfessionalId: 'UT-05321',
        },
      ];

      const findSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockProfessionalIds);

      const result = await repository.findByCamsTrusteeId(camsTrusteeId);

      expect(findSpy).toHaveBeenCalledWith(expectedQuery, undefined, undefined, {
        fields: ['evidence'],
        mode: 'EXCLUDE',
      });
      expect(result).toHaveLength(2);
      expect(result[0].acmsProfessionalId).toBe('NY-00063');
      expect(result[1].acmsProfessionalId).toBe('UT-05321');
      expect(result[0].camsTrusteeId).toBe(camsTrusteeId);
      expect(result[1].camsTrusteeId).toBe(camsTrusteeId);
    });

    test('should return empty array when trustee has no ACMS IDs', async () => {
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repository.findByCamsTrusteeId('trustee-unknown');

      expect(findSpy).toHaveBeenCalledWith(
        {
          conjunction: 'AND',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: { name: 'camsTrusteeId' },
              rightOperand: 'trustee-unknown',
            },
            isRealLinkCondition,
          ],
        },
        undefined,
        undefined,
        { fields: ['evidence'], mode: 'EXCLUDE' },
      );
      expect(result).toHaveLength(0);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      await expect(repository.findByCamsTrusteeId(camsTrusteeId)).rejects.toThrow(
        `Failed to find professional IDs for trustee ${camsTrusteeId}.`,
      );
      expect(findSpy).toHaveBeenCalledWith(expectedQuery, undefined, undefined, {
        fields: ['evidence'],
        mode: 'EXCLUDE',
      });
    });
  });

  describe('findByAcmsProfessionalId', () => {
    const acmsProfessionalId = 'AK-01414';
    const expectedQuery = {
      conjunction: 'AND',
      values: [
        {
          condition: 'EQUALS',
          leftOperand: { name: 'acmsProfessionalId' },
          rightOperand: acmsProfessionalId,
        },
        isRealLinkCondition,
      ],
    };

    test('should find all trustees with a given ACMS professional ID', async () => {
      // Test scenario: Gerard McHale Jr. has one ACMS ID (AK-01414) but multiple CAMS trustee IDs
      const mockProfessionalIds: TrusteeProfessionalIdDocument[] = [
        {
          ...sampleProfessionalId,
          id: 'prof-id-1',
          camsTrusteeId: 'trustee-11092',
          acmsProfessionalId,
        },
        {
          ...sampleProfessionalId,
          id: 'prof-id-2',
          camsTrusteeId: 'trustee-13340',
          acmsProfessionalId,
        },
      ];

      const findSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockProfessionalIds);

      const result = await repository.findByAcmsProfessionalId(acmsProfessionalId);

      expect(findSpy).toHaveBeenCalledWith(expectedQuery, undefined, undefined, {
        fields: ['evidence'],
        mode: 'EXCLUDE',
      });
      expect(result).toHaveLength(2);
      expect(result[0].camsTrusteeId).toBe('trustee-11092');
      expect(result[1].camsTrusteeId).toBe('trustee-13340');
    });

    test('should find the single trustee mapped to a given ACMS professional ID', async () => {
      const mockProfessionalId: TrusteeProfessionalIdDocument = {
        ...sampleProfessionalId,
        id: 'prof-id-1',
        camsTrusteeId: 'trustee-11092',
        acmsProfessionalId,
      };

      const findSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue([mockProfessionalId]);

      const result = await repository.findByAcmsProfessionalId(acmsProfessionalId);

      expect(findSpy).toHaveBeenCalledWith(expectedQuery, undefined, undefined, {
        fields: ['evidence'],
        mode: 'EXCLUDE',
      });
      expect(result).toHaveLength(1);
      expect(result[0].camsTrusteeId).toBe('trustee-11092');
      expect(result[0].acmsProfessionalId).toBe(acmsProfessionalId);
    });

    test('should return empty array when ACMS ID has no trustees', async () => {
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repository.findByAcmsProfessionalId('XX-99999');

      expect(findSpy).toHaveBeenCalledWith(
        {
          conjunction: 'AND',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: { name: 'acmsProfessionalId' },
              rightOperand: 'XX-99999',
            },
            isRealLinkCondition,
          ],
        },
        undefined,
        undefined,
        { fields: ['evidence'], mode: 'EXCLUDE' },
      );
      expect(result).toHaveLength(0);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      await expect(repository.findByAcmsProfessionalId(acmsProfessionalId)).rejects.toThrow(
        `Failed to find trustees with ACMS professional ID ${acmsProfessionalId}.`,
      );
      expect(findSpy).toHaveBeenCalledWith(expectedQuery, undefined, undefined, {
        fields: ['evidence'],
        mode: 'EXCLUDE',
      });
    });
  });

  describe('deleteByCamsTrusteeId', () => {
    const camsTrusteeId = 'trustee-1';
    const expectedQuery = {
      condition: 'EQUALS',
      leftOperand: { name: 'camsTrusteeId' },
      rightOperand: camsTrusteeId,
    };

    test('should delete all professional IDs for a trustee and return count', async () => {
      const deletedCount = 2;
      const deleteManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValue(deletedCount);

      const result = await repository.deleteByCamsTrusteeId(camsTrusteeId);

      expect(deleteManySpy).toHaveBeenCalledWith(expectedQuery);
      expect(result).toBe(deletedCount);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      const deleteManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockRejectedValue(error);

      await expect(repository.deleteByCamsTrusteeId(camsTrusteeId)).rejects.toThrow(
        `Failed to delete professional IDs for trustee ${camsTrusteeId}.`,
      );
      expect(deleteManySpy).toHaveBeenCalledWith(expectedQuery);
    });
  });

  describe('deleteAll', () => {
    const expectedQuery = {
      condition: 'EQUALS',
      leftOperand: { name: 'documentType' },
      rightOperand: 'TRUSTEE_PROFESSIONAL_ID',
    };

    test('should delete all professional IDs and return count', async () => {
      const deletedCount = 150;
      const deleteManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValue(deletedCount);

      const result = await repository.deleteAll();

      expect(deleteManySpy).toHaveBeenCalledWith(expectedQuery);
      expect(result).toBe(deletedCount);
    });

    test('should return 0 when no records exist', async () => {
      const deleteManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockResolvedValue(0);

      const result = await repository.deleteAll();

      expect(deleteManySpy).toHaveBeenCalledWith(expectedQuery);
      expect(result).toBe(0);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      const deleteManySpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'deleteMany')
        .mockRejectedValue(error);

      await expect(repository.deleteAll()).rejects.toThrow(
        'Failed to delete all professional IDs.',
      );
      expect(deleteManySpy).toHaveBeenCalledWith(expectedQuery);
    });
  });

  describe('bidirectional lookup', () => {
    test('should support lookups in both directions', async () => {
      const trusteeId = 'trustee-123';
      const acmsId = 'NY-00063';
      const mockMapping: TrusteeProfessionalIdDocument = {
        ...sampleProfessionalId,
        id: 'prof-id-1',
        camsTrusteeId: trusteeId,
        acmsProfessionalId: acmsId,
      };

      // Look up by CAMS trustee ID
      const findSpy1 = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValueOnce([mockMapping]);
      const byTrustee = await repository.findByCamsTrusteeId(trusteeId);
      expect(byTrustee).toHaveLength(1);
      expect(byTrustee[0].acmsProfessionalId).toBe(acmsId);
      findSpy1.mockRestore();

      // Look up by ACMS professional ID
      const findSpy2 = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValueOnce([mockMapping]);
      const byAcms = await repository.findByAcmsProfessionalId(acmsId);
      expect(byAcms).toHaveLength(1);
      expect(byAcms[0].camsTrusteeId).toBe(trusteeId);
      findSpy2.mockRestore();
    });
  });

  describe('findAll', () => {
    test('should return all auto-linked professional ID mappings', async () => {
      const allMappings: TrusteeProfessionalId[] = [
        { ...sampleProfessionalId, id: 'p1', camsTrusteeId: 't1', acmsProfessionalId: 'NY-00063' },
        { ...sampleProfessionalId, id: 'p2', camsTrusteeId: 't2', acmsProfessionalId: 'UT-05321' },
      ];
      const findSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(allMappings);

      const result = await repository.findAll();

      expect(findSpy).toHaveBeenCalledWith(
        {
          conjunction: 'AND',
          values: [
            {
              condition: 'EQUALS',
              leftOperand: { name: 'documentType' },
              rightOperand: 'TRUSTEE_PROFESSIONAL_ID',
            },
            isRealLinkCondition,
          ],
        },
        undefined,
        undefined,
        { fields: ['evidence'], mode: 'EXCLUDE' },
      );
      expect(result).toHaveLength(2);
    });

    test('should return empty array when collection is empty', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toHaveLength(0);
    });

    test('should propagate errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(new Error('db error'));

      await expect(repository.findAll()).rejects.toThrow(
        'Failed to load all professional ID mappings.',
      );
    });
  });
});
