import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentCosmosDbRepository } from './case.assignment.cosmosdb.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
describe('Test case assignment cosmosdb repository tests', () => {
  test('Should persist case assignment', async () => {
    const testCaseAttorneyAssignment: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      '123',
      'Susan Arbeit',
      CaseAssignmentRole.TrialAttorney,
      'Drew kerrigan',
    );

    const testCaseAssignmentCosmosDbRepository: CaseAssignmentCosmosDbRepository =
      new CaseAssignmentCosmosDbRepository();

    const assignmentId = await testCaseAssignmentCosmosDbRepository.createAssignment(
      appContext,
      testCaseAttorneyAssignment,
    );

    expect(assignmentId).toBeTruthy();

    // const actualAssignment = await testCaseAssignmentCosmosDbRepository.findAssignment(
    //   testCaseAttorneyAssignment,
    // );

    // expect(assignmentId).toEqual(actualAssignment.assignmentId);
    // expect(actualAssignment.caseId).toEqual(testCaseAttorneyAssignment.caseId);
    // expect(actualAssignment.role).toEqual(testCaseAttorneyAssignment.role);
    // expect(actualAssignment.attorneyName).toEqual(testCaseAttorneyAssignment.attorneyName);
    // expect(actualAssignment.caseTitle).toEqual(testCaseAttorneyAssignment.caseTitle);
  });

  test('Find case assignment by case id', async () => {
    const testCaseAssignmentCosmosDbRepository: CaseAssignmentCosmosDbRepository =
      new CaseAssignmentCosmosDbRepository();

    const actualAssignment = await testCaseAssignmentCosmosDbRepository.findAssignmentsByCaseId(
      '123',
    );

    expect(actualAssignment).not.toBeNull();
    expect(actualAssignment.length).toBeGreaterThanOrEqual(2);
  });

  test('Throws a permissions exception when user doesnt have permission to create an assignment', async () => {});
});
