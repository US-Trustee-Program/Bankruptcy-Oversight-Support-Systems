import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentCosmosDbRepository } from './case.assignment.cosmosdb.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
import { randomUUID } from 'crypto';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
describe('Test case assignment cosmosdb repository tests', () => {
  test('Should persist case assignment', async () => {
    const caseNumber = randomUUID();
    const testCaseAttorneyAssignment: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumber,
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

    const actualAssignment = await testCaseAssignmentCosmosDbRepository.findAssignmentsByCaseId(
      caseNumber,
    );

    console.log('Item id:', actualAssignment[0].id);
    console.log('Case id:', actualAssignment[0].caseId);
    console.log(actualAssignment[0].caseTitle);
    console.log(actualAssignment[0].attorneyName);
    console.log(actualAssignment[0].role);
    // const filteredAssignment = actualAssignment.filter((assignment) => {
    //   console.log(assignment);
    //   return assignment.id === assignmentId;
    // });
    //
    // expect(filteredAssignment.length).toEqual(1);
    //
    // expect(actualAssignment[0].caseId).toEqual(testCaseAttorneyAssignment.caseId);
    // expect(actualAssignment[0].role).toEqual(testCaseAttorneyAssignment.role);
    // expect(actualAssignment[0].attorneyName).toEqual(testCaseAttorneyAssignment.attorneyName);
    // expect(actualAssignment[0].caseTitle).toEqual(testCaseAttorneyAssignment.caseTitle);
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
