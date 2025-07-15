import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { getCamsError } from '../../../common-errors/error-utilities';
import { closeDeferred } from '../../../deferrable/defer-close';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';
import { CaseAssignmentMongoRepository } from './case-assignment.mongo.repository';
import { MongoCollectionAdapter } from './utils/mongo-adapter';

describe('case assignment repo tests', () => {
  let context: ApplicationContext;
  let repo: CaseAssignmentMongoRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = CaseAssignmentMongoRepository.getInstance(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
    repo.release();
  });

  describe('test happy paths', () => {
    test('should create assignment', async () => {
      const fakeAttorney = MockData.getAttorneyUser();
      const assignment = MockData.getAttorneyAssignment({ name: fakeAttorney.name });
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue(assignment.id);
      const actual = await repo.create(assignment);
      expect(actual).toEqual(assignment.id);
    });

    test('should update assignment', async () => {
      const fakeAttorney = MockData.getAttorneyUser();
      const assignment = MockData.getAttorneyAssignment({ name: fakeAttorney.name });
      jest
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: assignment.id, modifiedCount: 1, upsertedCount: 0 });
      const actual = await repo.update(assignment);
      expect(actual).toEqual(assignment.id);
    });

    test('should call findAssignmentsByAssignee', async () => {
      const userId = 'userId-Joe Nobel';
      const mockAssignments = [
        MockData.getAttorneyAssignment({ userId }),
        MockData.getAttorneyAssignment({ userId }),
      ];
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockAssignments);
      const actualAssignments = await repo.findAssignmentsByAssignee(userId);
      expect(actualAssignments).toEqual(mockAssignments);
    });

    test('should findAssignmentsByCaseId', async () => {
      const caseId = '111-22-33333';
      const mockAssignments = [
        MockData.getAttorneyAssignment({ caseId }),
        MockData.getAttorneyAssignment({ caseId }),
      ];
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue(mockAssignments);
      const actualAssignment = await repo.getAssignmentsForCases([caseId]);

      expect(actualAssignment).toEqual(new Map([[caseId, mockAssignments]]));
    });
  });

  describe('handle errors', () => {
    const error = new Error('some error');

    test('should handle error on create assignment', async () => {
      const fakeAttorney = MockData.getAttorneyUser();
      const assignment = MockData.getAttorneyAssignment({ name: fakeAttorney.name });
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      await expect(() => repo.create(assignment)).rejects.toThrow(
        getCamsError(
          error,
          'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS',
          'Unable to create assignment.',
        ),
      );
    });

    test('should handle error when updating assignment', async () => {
      const fakeAttorney = MockData.getAttorneyUser();
      const assignment = MockData.getAttorneyAssignment({ name: fakeAttorney.name });
      jest.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockRejectedValue(error);
      await expect(() => repo.update(assignment)).rejects.toThrow(
        getCamsError(
          error,
          'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS',
          'Unable to update assignment.',
        ),
      );
    });

    test('should handle error on findAssignmentsByAssignee', async () => {
      const userId = 'userId-Joe Nobel';
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      await expect(() => repo.findAssignmentsByAssignee(userId)).rejects.toThrow(
        getCamsError(
          error,
          'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS',
          'Unable to retrieve assignment.',
        ),
      );
    });

    test('should handle error on findAssignmentsByCaseId', async () => {
      const caseId = '111-22-33333';
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      await expect(() => repo.getAssignmentsForCases([caseId])).rejects.toThrow(
        getCamsError(
          error,
          'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS',
          'Unable to retrieve assignment.',
        ),
      );
    });

    test('should handle error on getAllActiveAssignments', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockRejectedValue(error);
      await expect(() => repo.getAllActiveAssignments()).rejects.toThrow(
        getCamsError(
          error,
          'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS',
          'Unable to retrieve assignments.',
        ),
      );
    });
  });

  describe('branch and singleton logic', () => {
    test('update returns undefined if modifiedCount is 0', async () => {
      const fakeAttorney = MockData.getAttorneyUser();
      const assignment = MockData.getAttorneyAssignment({ name: fakeAttorney.name });
      jest
        .spyOn(MongoCollectionAdapter.prototype, 'replaceOne')
        .mockResolvedValue({ id: assignment.id, modifiedCount: 0, upsertedCount: 0 });
      const actual = await repo.update(assignment);
      expect(actual).toBeUndefined();
    });

    test('getAssignmentsForCases returns empty map if no assignments', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const actual = await repo.getAssignmentsForCases(['some-case-id']);
      expect(actual).toEqual(new Map());
    });

    test('getAllActiveAssignments returns empty array if no assignments', async () => {
      jest.spyOn(MongoCollectionAdapter.prototype, 'find').mockResolvedValue([]);
      const actual = await repo.getAllActiveAssignments();
      expect(actual).toEqual([]);
    });

    test('singleton getInstance and dropInstance logic', async () => {
      // Ensure clean state using public API
      while (CaseAssignmentMongoRepository['referenceCount'] > 0) {
        await CaseAssignmentMongoRepository.dropInstance();
      }
      const context1 = await createMockApplicationContext();
      const repo1 = CaseAssignmentMongoRepository.getInstance(context1);
      expect(repo1).toBeDefined();
      expect(CaseAssignmentMongoRepository['referenceCount']).toBe(1);
      const context2 = await createMockApplicationContext();
      const repo2 = CaseAssignmentMongoRepository.getInstance(context2);
      expect(repo2).toBe(repo1); // Should be the same instance
      expect(CaseAssignmentMongoRepository['referenceCount']).toBe(2);
      // Drop once, should not close
      const closeSpy = jest.spyOn(repo1['client'], 'close').mockResolvedValue();
      CaseAssignmentMongoRepository.dropInstance();
      expect(CaseAssignmentMongoRepository['referenceCount']).toBe(1);
      expect(closeSpy).not.toHaveBeenCalled();
      // Drop again, should close and null instance
      CaseAssignmentMongoRepository.dropInstance();
      expect(CaseAssignmentMongoRepository['referenceCount']).toBe(0);
      // Wait for close to resolve
      await Promise.resolve();
      expect(closeSpy).toHaveBeenCalled();
      expect(CaseAssignmentMongoRepository['instance']).toBeNull();
    });

    test('release calls dropInstance', async () => {
      const dropSpy = jest.spyOn(CaseAssignmentMongoRepository, 'dropInstance');
      repo.release();
      expect(dropSpy).toHaveBeenCalled();
      dropSpy.mockRestore();
    });
  });
});
