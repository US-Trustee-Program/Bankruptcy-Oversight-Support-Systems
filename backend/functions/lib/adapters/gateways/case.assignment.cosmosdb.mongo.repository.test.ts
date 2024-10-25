import { CaseAssignmentCosmosMongoDbRepository } from './case.assignment.cosmosdb.mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../types/basic';
import { closeDeferred } from '../../defer-close';

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

  test('should update assignment', async () => {
    const fakeAttorney = MockData.getAttorneyUser();
    const assignment = MockData.getAttorneyAssignment({ name: fakeAttorney.name });

    // spyOn replaceOne

    await repo.update(assignment);

    // expect something
  });

  test('should call findAssignmentsByAssignee', async () => {
    const userId = 'userId-Joe Nobel';
    const assignments = await repo.findAssignmentsByAssignee(userId);

    console.log(assignments);
    expect(assignments).not.toBeNull();
  });
});
