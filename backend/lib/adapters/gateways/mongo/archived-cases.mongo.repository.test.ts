import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { ArchivedCasesMongoRepository } from './archived-cases.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';

describe('archived cases repo tests', () => {
  let context: ApplicationContext;
  let repo: ArchivedCasesMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = ArchivedCasesMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
    repo.release();
  });

  describe('archive document', () => {
    test('should archive a document with metadata', async () => {
      const originalDoc = MockData.getSyncedCase();
      const caseId = originalDoc.caseId;
      const collection = 'cases';
      const archiveId = 'archive-doc-123';

      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(archiveId);

      await repo.archiveDocument(originalDoc, collection, caseId);

      expect(MongoCollectionAdapter.prototype.insertOne).toHaveBeenCalled();
    });

    test('should handle archiving documents from different collections', async () => {
      const doc = MockData.getSyncedCase();
      const caseId = doc.caseId;
      const collections = ['cases', 'orders', 'notes'];

      const insertSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('archive-id');

      for (const collection of collections) {
        await repo.archiveDocument(doc, collection, caseId);
      }

      expect(insertSpy).toHaveBeenCalledTimes(3);
    });

    test('should preserve original document structure when archiving', async () => {
      const originalDoc = {
        id: 'case123',
        title: 'Test Case',
        status: 'active',
      };
      const caseId = '12-12345';
      const collection = 'cases';

      const insertSpy = vi
        .spyOn(MongoCollectionAdapter.prototype, 'insertOne')
        .mockResolvedValue('archive-id');

      await repo.archiveDocument(originalDoc, collection, caseId);

      const callArgs = insertSpy.mock.calls[0][0];
      expect(callArgs).toHaveProperty('id', 'case123');
      expect(callArgs).toHaveProperty('title', 'Test Case');
      expect(callArgs).toHaveProperty('status', 'active');
      expect(callArgs).toHaveProperty('archivedOn');
      expect(callArgs).toHaveProperty('archivedBy');
      expect(callArgs).toHaveProperty('archivedReason', 'DELETED_IN_ACMS');
      expect(callArgs).toHaveProperty('originalCollection', 'cases');
      expect(callArgs).toHaveProperty('caseId', '12-12345');
    });
  });

  describe('error handling', () => {
    const error = new Error('some error');

    test('should handle error on archiveDocument', async () => {
      const doc = MockData.getSyncedCase();
      vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);

      await expect(() => repo.archiveDocument(doc, 'cases', doc.caseId)).rejects.toThrow(
        expect.objectContaining({
          module: 'ARCHIVED-CASES-MONGO-REPOSITORY',
        }),
      );
    });
  });

  describe('singleton and release logic', () => {
    test('singleton getInstance and dropInstance logic', async () => {
      while (ArchivedCasesMongoRepository['referenceCount'] > 0) {
        await ArchivedCasesMongoRepository.dropInstance();
      }

      const context1 = await createMockApplicationContext();
      const repo1 = ArchivedCasesMongoRepository.getInstance(context1);
      expect(repo1).toBeDefined();
      expect(ArchivedCasesMongoRepository['referenceCount']).toBe(1);

      const context2 = await createMockApplicationContext();
      const repo2 = ArchivedCasesMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo1);
      expect(ArchivedCasesMongoRepository['referenceCount']).toBe(2);

      const closeSpy = vi.spyOn(repo1['client'], 'close').mockResolvedValue();
      ArchivedCasesMongoRepository.dropInstance();
      expect(ArchivedCasesMongoRepository['referenceCount']).toBe(1);
      expect(closeSpy).not.toHaveBeenCalled();

      ArchivedCasesMongoRepository.dropInstance();
      expect(ArchivedCasesMongoRepository['referenceCount']).toBe(0);
      await Promise.resolve();
      expect(closeSpy).toHaveBeenCalled();
      expect(ArchivedCasesMongoRepository['instance']).toBeNull();
    });

    test('release calls dropInstance', async () => {
      const dropSpy = vi.spyOn(ArchivedCasesMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });
  });
});
