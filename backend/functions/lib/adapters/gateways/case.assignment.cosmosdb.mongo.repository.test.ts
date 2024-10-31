import { CaseAssignmentCosmosMongoDbRepository } from './case.assignment.cosmosdb.mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../types/basic';
import { closeDeferred } from '../../defer-close';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import { getCamsError } from '../../common-errors/error-utilities';

describe('offices repo', () => {
  let context: ApplicationContext;
  let repo: CaseAssignmentCosmosMongoDbRepository;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    repo = new CaseAssignmentCosmosMongoDbRepository(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
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
      jest.spyOn(MongoCollectionAdapter.prototype, 'replaceOne').mockResolvedValue(assignment.id);
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
      const actualAssignment = await repo.findAssignmentsByCaseId(caseId);

      expect(actualAssignment).toEqual(mockAssignments);
    });
  });

  describe('handle errors', () => {
    const error = new Error('some error');

    test('should handle error on create assignment', async () => {
      const fakeAttorney = MockData.getAttorneyUser();
      const assignment = MockData.getAttorneyAssignment({ name: fakeAttorney.name });
      jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockRejectedValue(error);
      expect(async () => await repo.create(assignment)).rejects.toThrow(
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
      await expect(async () => await repo.update(assignment)).rejects.toThrow(
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
      await expect(async () => await repo.findAssignmentsByAssignee(userId)).rejects.toThrow(
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
      await expect(async () => await repo.findAssignmentsByCaseId(caseId)).rejects.toThrow(
        getCamsError(
          error,
          'MONGO_COSMOS_DB_REPOSITORY_ASSIGNMENTS',
          'Unable to retrieve assignment.',
        ),
      );
    });
  });
});
