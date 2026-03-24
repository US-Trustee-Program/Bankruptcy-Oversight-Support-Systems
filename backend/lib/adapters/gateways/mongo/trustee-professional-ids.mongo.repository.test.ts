import { vi, beforeEach, afterEach, afterAll, describe, test, expect } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import {
  TrusteeProfessionalIdsMongoRepository,
  TrusteeProfessionalIdDocument,
} from './trustee-professional-ids.mongo.repository';
import { TrusteeProfessionalId } from '@common/cams/trustee-professional-ids';
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
    createdOn: '2024-01-15T10:00:00Z',
    createdBy: mockUser,
    updatedOn: '2024-01-15T10:00:00Z',
    updatedBy: mockUser,
  };

  beforeEach(async () => {
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

  describe('createProfessionalId', () => {
    const camsTrusteeId = 'trustee-123';
    const acmsProfessionalId = 'NY-00063';

    test('should be idempotent - return existing mapping when exact pair already exists', async () => {
      const existingMapping: TrusteeProfessionalIdDocument = {
        ...sampleProfessionalId,
        id: 'existing-prof-id',
        camsTrusteeId,
        acmsProfessionalId,
      };

      const findSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue([existingMapping]);

      const result = await repository.createProfessionalId(
        camsTrusteeId,
        acmsProfessionalId,
        mockUser,
      );

      expect(findSpy).toHaveBeenCalled();
      expect(result.id).toBe('existing-prof-id');
      expect(result.camsTrusteeId).toBe(camsTrusteeId);
      expect(result.acmsProfessionalId).toBe(acmsProfessionalId);
    });

    test('should create a new professional ID mapping successfully', async () => {
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const insertOneSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('new-prof-id');

      const result = await repository.createProfessionalId(
        camsTrusteeId,
        acmsProfessionalId,
        mockUser,
      );

      expect(findSpy).toHaveBeenCalled();
      expect(insertOneSpy).toHaveBeenCalled();
      expect(result.id).toBe('new-prof-id');
      expect(result.camsTrusteeId).toBe(camsTrusteeId);
      expect(result.acmsProfessionalId).toBe(acmsProfessionalId);
      expect(result.documentType).toBe('TRUSTEE_PROFESSIONAL_ID');
    });

    test('should allow same ACMS ID mapped to different trustees (many-to-one)', async () => {
      const differentTrusteeId = 'different-trustee-456';

      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('new-prof-id-2');

      const result = await repository.createProfessionalId(
        differentTrusteeId,
        acmsProfessionalId,
        mockUser,
      );

      expect(result.camsTrusteeId).toBe(differentTrusteeId);
      expect(result.acmsProfessionalId).toBe(acmsProfessionalId);
    });

    test('should handle database errors during creation', async () => {
      const error = new Error('Database connection failed');

      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);

      await expect(
        repository.createProfessionalId(camsTrusteeId, acmsProfessionalId, mockUser),
      ).rejects.toThrow();
    });
  });

  describe('findByCamsTrusteeId', () => {
    const camsTrusteeId = 'trustee-1';
    const expectedQuery = {
      condition: 'EQUALS',
      leftOperand: { name: 'camsTrusteeId' },
      rightOperand: camsTrusteeId,
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

      expect(findSpy).toHaveBeenCalledWith(expectedQuery);
      expect(result).toHaveLength(2);
      expect(result[0].acmsProfessionalId).toBe('NY-00063');
      expect(result[1].acmsProfessionalId).toBe('UT-05321');
      expect(result[0].camsTrusteeId).toBe(camsTrusteeId);
      expect(result[1].camsTrusteeId).toBe(camsTrusteeId);
    });

    test('should return empty array when trustee has no ACMS IDs', async () => {
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repository.findByCamsTrusteeId('trustee-unknown');

      expect(findSpy).toHaveBeenCalledWith({
        condition: 'EQUALS',
        leftOperand: { name: 'camsTrusteeId' },
        rightOperand: 'trustee-unknown',
      });
      expect(result).toHaveLength(0);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      await expect(repository.findByCamsTrusteeId(camsTrusteeId)).rejects.toThrow(
        `Failed to find professional IDs for trustee ${camsTrusteeId}.`,
      );
      expect(findSpy).toHaveBeenCalledWith(expectedQuery);
    });
  });

  describe('findByAcmsProfessionalId', () => {
    const acmsProfessionalId = 'AK-01414';
    const expectedQuery = {
      condition: 'EQUALS',
      leftOperand: { name: 'acmsProfessionalId' },
      rightOperand: acmsProfessionalId,
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
        {
          ...sampleProfessionalId,
          id: 'prof-id-3',
          camsTrusteeId: 'trustee-17287',
          acmsProfessionalId,
        },
        {
          ...sampleProfessionalId,
          id: 'prof-id-4',
          camsTrusteeId: 'trustee-27472',
          acmsProfessionalId,
        },
      ];

      const findSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'find')
        .mockResolvedValue(mockProfessionalIds);

      const result = await repository.findByAcmsProfessionalId(acmsProfessionalId);

      expect(findSpy).toHaveBeenCalledWith(expectedQuery);
      expect(result).toHaveLength(4);
      expect(result[0].camsTrusteeId).toBe('trustee-11092');
      expect(result[1].camsTrusteeId).toBe('trustee-13340');
      expect(result[2].camsTrusteeId).toBe('trustee-17287');
      expect(result[3].camsTrusteeId).toBe('trustee-27472');
      expect(result[0].acmsProfessionalId).toBe(acmsProfessionalId);
      expect(result[1].acmsProfessionalId).toBe(acmsProfessionalId);
      expect(result[2].acmsProfessionalId).toBe(acmsProfessionalId);
      expect(result[3].acmsProfessionalId).toBe(acmsProfessionalId);
    });

    test('should return empty array when ACMS ID has no trustees', async () => {
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repository.findByAcmsProfessionalId('XX-99999');

      expect(findSpy).toHaveBeenCalledWith({
        condition: 'EQUALS',
        leftOperand: { name: 'acmsProfessionalId' },
        rightOperand: 'XX-99999',
      });
      expect(result).toHaveLength(0);
    });

    test('should handle database errors', async () => {
      const error = new Error('Database connection failed');
      const findSpy = vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);

      await expect(repository.findByAcmsProfessionalId(acmsProfessionalId)).rejects.toThrow(
        `Failed to find trustees with ACMS professional ID ${acmsProfessionalId}.`,
      );
      expect(findSpy).toHaveBeenCalledWith(expectedQuery);
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

  describe('many-to-many scenarios', () => {
    test('should support finding multiple ACMS IDs for one trustee (Harvey Barr scenario)', async () => {
      const trusteeId = 'harvey-barr';
      const mockProfessionalIds: TrusteeProfessionalIdDocument[] = [
        {
          ...sampleProfessionalId,
          id: 'prof-id-1',
          camsTrusteeId: trusteeId,
          acmsProfessionalId: 'NY-00063',
        },
        {
          ...sampleProfessionalId,
          id: 'prof-id-2',
          camsTrusteeId: trusteeId,
          acmsProfessionalId: 'UT-05321',
        },
      ];

      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockProfessionalIds);

      const allIds = await repository.findByCamsTrusteeId(trusteeId);

      expect(allIds).toHaveLength(2);
      expect(allIds[0].acmsProfessionalId).toBe('NY-00063');
      expect(allIds[1].acmsProfessionalId).toBe('UT-05321');
    });

    test('should support finding multiple trustees for one ACMS ID (Gerard McHale Jr. scenario)', async () => {
      const acmsId = 'AK-01414';
      const trusteeIds = ['trustee-11092', 'trustee-13340', 'trustee-17287', 'trustee-27472'];

      const mockProfessionalIds: TrusteeProfessionalIdDocument[] = trusteeIds.map(
        (trusteeId, i) => ({
          ...sampleProfessionalId,
          id: `prof-id-${i + 1}`,
          camsTrusteeId: trusteeId,
          acmsProfessionalId: acmsId,
        }),
      );

      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockProfessionalIds);

      const allTrustees = await repository.findByAcmsProfessionalId(acmsId);

      expect(allTrustees).toHaveLength(4);
      expect(allTrustees.map((t) => t.camsTrusteeId)).toEqual(trusteeIds);
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
});
