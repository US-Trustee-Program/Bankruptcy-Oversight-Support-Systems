import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentCosmosDbRepository } from './case.assignment.cosmosdb.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
import { randomUUID } from 'crypto';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
describe('Test case assignment cosmosdb repository tests', () => {
  // TODO : still need to refactor to use mocked cosmos client
  test('should create two assignments and find both of them', async () => {
    const caseNumber = randomUUID();
    const testCaseAttorneyAssignment1: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumber,
      'Susan Arbeit',
      CaseAssignmentRole.TrialAttorney,
      'Drew Kerrigan',
    );
    const testCaseAttorneyAssignment2: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumber,
      'Jeffery McCaslin',
      CaseAssignmentRole.TrialAttorney,
      'Drew Kerrigan',
    );

    const testCaseAssignmentCosmosDbRepository: CaseAssignmentCosmosDbRepository =
      new CaseAssignmentCosmosDbRepository(true);

    const assignmentId1 = await testCaseAssignmentCosmosDbRepository.createAssignment(
      appContext,
      testCaseAttorneyAssignment1,
    );
    const assignmentId2 = await testCaseAssignmentCosmosDbRepository.createAssignment(
      appContext,
      testCaseAttorneyAssignment2,
    );

    expect(assignmentId1).toBeTruthy();
    expect(assignmentId2).toBeTruthy();

    const actualAssignments =
      await testCaseAssignmentCosmosDbRepository.findAssignmentsByCaseId(caseNumber);

    expect(actualAssignments.length).toEqual(2);

    const assignment1 = actualAssignments.find((assign) => assign.id === assignmentId1);
    const assignment2 = actualAssignments.find((assign) => assign.id === assignmentId2);

    expect(assignment1.caseId).toEqual(testCaseAttorneyAssignment1.caseId);
    expect(assignment1.role).toEqual(testCaseAttorneyAssignment1.role);
    expect(assignment1.attorneyName).toEqual(testCaseAttorneyAssignment1.attorneyName);
    expect(assignment1.caseTitle).toEqual(testCaseAttorneyAssignment1.caseTitle);
    expect(assignment2.caseId).toEqual(testCaseAttorneyAssignment2.caseId);
    expect(assignment2.role).toEqual(testCaseAttorneyAssignment2.role);
    expect(assignment2.attorneyName).toEqual(testCaseAttorneyAssignment2.attorneyName);
    expect(assignment2.caseTitle).toEqual(testCaseAttorneyAssignment2.caseTitle);
  });

  xtest('Throws a permissions exception when user doesnt have permission to create an assignment', async () => {});
});
