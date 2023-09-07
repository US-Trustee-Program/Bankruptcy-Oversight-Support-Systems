import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentCosmosDbRepository } from './case.assignment.cosmosdb.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
import { randomUUID } from 'crypto';

const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
describe('Test case assignment cosmosdb repository tests', () => {
  let repository: CaseAssignmentCosmosDbRepository;
  beforeEach(() => {
    repository = new CaseAssignmentCosmosDbRepository(appContext, true);
  });

  test('should create two assignments and find both of them', async () => {
    const caseNumber = randomUUID();
    const testCaseAttorneyAssignment1: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumber,
      'Susan Arbeit',
      CaseAssignmentRole.TrialAttorney,
    );
    const testCaseAttorneyAssignment2: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumber,
      'Jeffery McCaslin',
      CaseAssignmentRole.TrialAttorney,
    );

    const assignmentId1 = await repository.createAssignment(testCaseAttorneyAssignment1);
    const assignmentId2 = await repository.createAssignment(testCaseAttorneyAssignment2);

    expect(assignmentId1).toBeTruthy();
    expect(assignmentId2).toBeTruthy();

    const actualAssignments = await repository.findAssignmentsByCaseId(caseNumber);

    expect(actualAssignments.length).toEqual(2);

    const assignment1 = actualAssignments.find((assign) => assign.id === assignmentId1);
    const assignment2 = actualAssignments.find((assign) => assign.id === assignmentId2);

    expect(assignment1.caseId).toEqual(testCaseAttorneyAssignment1.caseId);
    expect(assignment1.role).toEqual(testCaseAttorneyAssignment1.role);
    expect(assignment1.attorneyName).toEqual(testCaseAttorneyAssignment1.attorneyName);
    expect(assignment2.caseId).toEqual(testCaseAttorneyAssignment2.caseId);
    expect(assignment2.role).toEqual(testCaseAttorneyAssignment2.role);
    expect(assignment2.attorneyName).toEqual(testCaseAttorneyAssignment2.attorneyName);
  });

  test('should find only assignments for the requested case', async () => {
    const caseNumberOne = randomUUID();
    const caseNumberTwo = randomUUID();
    const testCaseAttorneyAssignment1: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumberOne,
      'Susan Arbeit',
      CaseAssignmentRole.TrialAttorney,
    );
    const testCaseAttorneyAssignment2: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumberTwo,
      'Jeffery McCaslin',
      CaseAssignmentRole.TrialAttorney,
    );

    const assignmentId1 = await repository.createAssignment(testCaseAttorneyAssignment1);
    const assignmentId2 = await repository.createAssignment(testCaseAttorneyAssignment2);

    const actualAssignmentsOne = await repository.findAssignmentsByCaseId(caseNumberOne);

    expect(actualAssignmentsOne.length).toEqual(1);

    const assignment1 = actualAssignmentsOne.find((assign) => assign.id === assignmentId1);
    const assignment2 = actualAssignmentsOne.find((assign) => assign.id === assignmentId2);

    expect(assignment1.caseId).toEqual(testCaseAttorneyAssignment1.caseId);
    expect(assignment1.role).toEqual(testCaseAttorneyAssignment1.role);
    expect(assignment1.attorneyName).toEqual(testCaseAttorneyAssignment1.attorneyName);
    expect(assignment2).toBeFalsy();

    const actualAssignmentsTwo = await repository.findAssignmentsByCaseId(caseNumberTwo);

    expect(actualAssignmentsOne.length).toEqual(1);

    const assignmentOne = actualAssignmentsTwo.find((assign) => assign.id === assignmentId1);
    const assignmentTwo = actualAssignmentsTwo.find((assign) => assign.id === assignmentId2);

    expect(assignmentTwo.caseId).toEqual(testCaseAttorneyAssignment2.caseId);
    expect(assignmentTwo.role).toEqual(testCaseAttorneyAssignment2.role);
    expect(assignmentTwo.attorneyName).toEqual(testCaseAttorneyAssignment2.attorneyName);
    expect(assignmentOne).toBeFalsy();
  });

  test('Throws a permissions exception when user doesnt have permission to create an assignment', async () => {
    const testCaseAttorneyAssignment: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      'throw-permissions-error',
      'some-attorney-name',
      CaseAssignmentRole.TrialAttorney,
    );

    await expect(repository.createAssignment(testCaseAttorneyAssignment)).rejects.toThrow(
      'Request is forbidden',
    );
  });

  test('should throw a not implemented error when getAssignment is called', async () => {
    try {
      await repository.getAssignment('some-assignment');
      // Ensure that if we do not catch the expected error, we will fail.
      expect(true).toBeFalsy();
    } catch (e) {
      expect((e as Error).message).toEqual('Method not implemented.');
    }
  });

  test('should throw a not implemented error when findAssignment is called', async () => {
    const assignment: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      'some-case-number',
      'some-attorney-name',
      CaseAssignmentRole.TrialAttorney,
    );
    try {
      await repository.findAssignment(assignment);
      // Ensure that if we do not catch the expected error, we will fail.
      expect(true).toBeFalsy();
    } catch (e) {
      expect((e as Error).message).toEqual('Method not implemented.');
    }
  });

  test('should throw a not implemented error when getCount is called', async () => {
    try {
      await repository.getCount();
      // Ensure that if we do not catch the expected error, we will fail.
      expect(true).toBeFalsy();
    } catch (e) {
      expect((e as Error).message).toEqual('Method not implemented.');
    }
  });

  test('Should throw AggregateAuthentication Error for authentication errors from credentials', async () => {
    try {
      await repository.findAssignmentsByCaseId('throw auth error');
      expect(true).toBeFalsy();
    } catch (e) {
      expect((e as Error).message).toEqual('Failed to authenticate to Azure');
    }
  });
});
