import { CaseAssignmentCosmosMongoDbRepository } from './case.assignment.cosmosdb.mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '../../../../../common/src/cams/test-utilities/mock-data';

describe('offices repo', () => {
  let repo: CaseAssignmentCosmosMongoDbRepository;

  beforeEach(async () => {
    const context = await createMockApplicationContext();
    repo = new CaseAssignmentCosmosMongoDbRepository(context);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (repo?.close) await repo.close();
  });

  test('should call updateAssignment', async () => {
    const caseId = '081-26-63921';
    const assignments = await repo.findAssignmentsByCaseId(caseId);

    console.log(assignments);
    expect(assignments).not.toBeNull();

    const fakeAttorney = MockData.getAttorneyUser();
    delete fakeAttorney.id;
    let assignmentOne = assignments[0];
    assignmentOne = { ...assignmentOne, ...fakeAttorney };
    await repo.updateAssignment(assignmentOne);

    const updatedAssignments = await repo.findAssignmentsByCaseId(caseId);
    const updatedAssignment = updatedAssignments.filter(
      (assign) => assign.name === fakeAttorney.name,
    )[0];
    expect(updatedAssignment).toBeTruthy();

    await repo.updateAssignment(assignments[0]);
  });

  test('should call findAssignmentsByAssignee', async () => {
    const userId = 'userId-Joe Nobel';
    const assignments = await repo.findAssignmentsByAssignee(userId);

    console.log(assignments);
    expect(assignments).not.toBeNull();
  });
});
