import { vi, describe, test, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { ApplicationContext } from '../../types/basic';
import { TrusteeVariationMongoRepository } from './trustee-variation.mongo.repository';
import { TrusteeVariation } from '@common/cams/trustee-variation';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { MongoCollectionAdapter } from './utils/mongo-adapter';
import { closeDeferred } from '../../../deferrable/defer-close';
import { Creatable } from '@common/cams/creatable';

describe('TrusteeVariationMongoRepository', () => {
  let context: ApplicationContext;
  let repository: TrusteeVariationMongoRepository;

  const sampleVariation: TrusteeVariation = {
    id: 'variation-1',
    documentType: 'TRUSTEE_VARIATION',
    fingerprint: 'fp-abc123',
    variant: '{"firstName":"john","lastName":"doe"}',
    trusteeId: 'trustee-123',
    createdOn: '2025-01-01T00:00:00.000Z',
    createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
  };

  beforeEach(async () => {
    vi.stubEnv('MONGO_CONNECTION_STRING', 'mongodb://localhost:27017');
    context = await createMockApplicationContext();
    repository = new TrusteeVariationMongoRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.unstubAllEnvs();
    repository.release();
  });

  afterAll(() => {
    TrusteeVariationMongoRepository.dropInstance();
  });

  describe('getInstance and dropInstance', () => {
    test('should manage reference count correctly', async () => {
      const instance1 = TrusteeVariationMongoRepository.getInstance(context);
      const instance2 = TrusteeVariationMongoRepository.getInstance(context);
      const instance3 = TrusteeVariationMongoRepository.getInstance(context);

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);

      instance1.release();
      instance2.release();

      const instance4 = TrusteeVariationMongoRepository.getInstance(context);
      expect(instance4).toBe(instance1);

      instance3.release();
      instance4.release();
    });
  });

  describe('findByFingerprint', () => {
    test('returns an empty array when the bucket has no members', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      const result = await repository.findByFingerprint('fp-empty');

      expect(result).toEqual([]);
    });

    test('returns the single matching document', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([sampleVariation]);

      const result = await repository.findByFingerprint('fp-abc123');

      expect(result).toEqual([sampleVariation]);
      expect(MongoCollectionAdapter.prototype.find).toHaveBeenCalledWith(
        expect.objectContaining({
          conjunction: 'AND',
          values: expect.arrayContaining([
            expect.objectContaining({
              condition: 'EQUALS',
              leftOperand: { name: 'documentType' },
              rightOperand: 'TRUSTEE_VARIATION',
            }),
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
      const otherVariant: TrusteeVariation = {
        ...sampleVariation,
        id: 'variation-2',
        variant: '{"firstName":"jane","lastName":"doe"}',
        trusteeId: 'trustee-456',
      };
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([
        sampleVariation,
        otherVariant,
      ]);

      const result = await repository.findByFingerprint('fp-abc123');

      expect(result).toEqual([sampleVariation, otherVariant]);
    });

    test('should wrap unexpected errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(repository.findByFingerprint('fp-abc123')).rejects.toThrow(
        'Failed to find trustee variations for fingerprint fp-abc123.',
      );
    });
  });

  describe('createVariation', () => {
    test('should insert the variation and return it with the generated id', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('variation-new');
      const input: Creatable<TrusteeVariation> = {
        documentType: 'TRUSTEE_VARIATION',
        fingerprint: 'fp-abc123',
        variant: '{"firstName":"john","lastName":"doe"}',
        trusteeId: 'trustee-123',
        createdOn: '2025-01-01T00:00:00.000Z',
        createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
        updatedOn: '2025-01-01T00:00:00.000Z',
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      };

      const result = await repository.createVariation(input);

      expect(result).toEqual({ id: 'variation-new', ...input });
      expect(MongoCollectionAdapter.prototype.insertOne).toHaveBeenCalledWith(input);
    });

    test('should wrap unexpected errors', async () => {
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(
        new Error('Database connection failed'),
      );
      const input: Creatable<TrusteeVariation> = {
        documentType: 'TRUSTEE_VARIATION',
        fingerprint: 'fp-abc123',
        variant: '{"firstName":"john","lastName":"doe"}',
        trusteeId: 'trustee-123',
        createdOn: '2025-01-01T00:00:00.000Z',
        createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
        updatedOn: '2025-01-01T00:00:00.000Z',
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      };

      await expect(repository.createVariation(input)).rejects.toThrow(
        'Failed to create trustee variation for fingerprint fp-abc123.',
      );
    });

    test('should return the winner document and warn when a duplicate-key race is lost', async () => {
      const input: Creatable<TrusteeVariation> = {
        documentType: 'TRUSTEE_VARIATION',
        fingerprint: 'fp-abc123',
        variant: '{"firstName":"john","lastName":"doe"}',
        trusteeId: 'trustee-123',
        createdOn: '2025-01-01T00:00:00.000Z',
        createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
        updatedOn: '2025-01-01T00:00:00.000Z',
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      };
      const raceError = new Error(
        'E11000 duplicate key error collection: trustee-variation index: fingerprint_1_variant_1_documentType_1',
      );
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(raceError);
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([sampleVariation]);
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const result = await repository.createVariation(input);

      expect(result).toEqual(sampleVariation);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('fp-abc123'),
      );
    });

    test('should still throw when a duplicate-key error is caught but no matching document is found', async () => {
      const input: Creatable<TrusteeVariation> = {
        documentType: 'TRUSTEE_VARIATION',
        fingerprint: 'fp-abc123',
        variant: '{"firstName":"john","lastName":"doe"}',
        trusteeId: 'trustee-123',
        createdOn: '2025-01-01T00:00:00.000Z',
        createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
        updatedOn: '2025-01-01T00:00:00.000Z',
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      };
      const raceError = new Error('E11000 duplicate key error');
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(raceError);
      vi.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);

      await expect(repository.createVariation(input)).rejects.toThrow(
        'Failed to create trustee variation for fingerprint fp-abc123.',
      );
    });
  });
});
