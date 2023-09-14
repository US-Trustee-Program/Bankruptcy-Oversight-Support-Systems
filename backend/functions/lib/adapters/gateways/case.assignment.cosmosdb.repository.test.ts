import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentCosmosDbRepository } from './case.assignment.cosmosdb.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
import { randomUUID } from 'crypto';

const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
const perryMason = 'Perry Mason';
const benMatlock = 'Ben Matlock';
const clairHuxtable = 'Clair Huxtable';
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
    expect(assignment1.name).toEqual(testCaseAttorneyAssignment1.name);
    expect(assignment2.caseId).toEqual(testCaseAttorneyAssignment2.caseId);
    expect(assignment2.role).toEqual(testCaseAttorneyAssignment2.role);
    expect(assignment2.name).toEqual(testCaseAttorneyAssignment2.name);
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
    expect(assignment1.name).toEqual(testCaseAttorneyAssignment1.name);
    expect(assignment2).toBeFalsy();

    const actualAssignmentsTwo = await repository.findAssignmentsByCaseId(caseNumberTwo);

    expect(actualAssignmentsOne.length).toEqual(1);

    const assignmentOne = actualAssignmentsTwo.find((assign) => assign.id === assignmentId1);
    const assignmentTwo = actualAssignmentsTwo.find((assign) => assign.id === assignmentId2);

    expect(assignmentTwo.caseId).toEqual(testCaseAttorneyAssignment2.caseId);
    expect(assignmentTwo.role).toEqual(testCaseAttorneyAssignment2.role);
    expect(assignmentTwo.name).toEqual(testCaseAttorneyAssignment2.name);
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

  test('Should throw AggregateAuthentication Error for authentication errors from credentials', async () => {
    try {
      await repository.findAssignmentsByCaseId('throw auth error');
      expect(true).toBeFalsy();
    } catch (e) {
      expect((e as Error).message).toEqual('Failed to authenticate to Azure');
    }
  });

  test('should find all assignments for a given attorney', async () => {
    const caseNumberOne = randomUUID();
    const testCaseAttorneyAssignment1: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumberOne,
      perryMason,
      CaseAssignmentRole.TrialAttorney,
    );
    const testCaseAttorneyAssignment2: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumberOne,
      benMatlock,
      CaseAssignmentRole.TrialAttorney,
    );

    const caseNumberTwo = randomUUID();
    const testCaseAttorneyAssignment3: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumberTwo,
      clairHuxtable,
      CaseAssignmentRole.TrialAttorney,
    );
    const testCaseAttorneyAssignment4: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumberTwo,
      perryMason,
      CaseAssignmentRole.TrialAttorney,
    );

    const caseNumberThree = randomUUID();
    const testCaseAttorneyAssignment5: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumberThree,
      clairHuxtable,
      CaseAssignmentRole.TrialAttorney,
    );
    const testCaseAttorneyAssignment6: CaseAttorneyAssignment = new CaseAttorneyAssignment(
      caseNumberThree,
      benMatlock,
      CaseAssignmentRole.TrialAttorney,
    );

    await repository.createAssignment(testCaseAttorneyAssignment1);
    await repository.createAssignment(testCaseAttorneyAssignment2);
    await repository.createAssignment(testCaseAttorneyAssignment3);
    await repository.createAssignment(testCaseAttorneyAssignment4);
    await repository.createAssignment(testCaseAttorneyAssignment5);
    await repository.createAssignment(testCaseAttorneyAssignment6);

    const perryAssignments = await repository.findAssignmentsByAssigneeName(perryMason);
    const clairAssignments = await repository.findAssignmentsByAssigneeName(clairHuxtable);
    const benAssignments = await repository.findAssignmentsByAssigneeName(benMatlock);

    expect(perryAssignments.length).toEqual(2);
    expect(perryAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caseId: caseNumberOne,
          name: perryMason,
          role: CaseAssignmentRole.TrialAttorney,
        }),
        expect.objectContaining({
          caseId: caseNumberTwo,
          name: perryMason,
          role: CaseAssignmentRole.TrialAttorney,
        }),
      ]),
    );
    expect(perryAssignments).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ name: clairHuxtable })]),
    );
    expect(perryAssignments).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ name: benMatlock })]),
    );

    expect(clairAssignments.length).toEqual(2);
    expect(clairAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caseId: caseNumberTwo,
          name: clairHuxtable,
          role: CaseAssignmentRole.TrialAttorney,
        }),
        expect.objectContaining({
          caseId: caseNumberThree,
          name: clairHuxtable,
          role: CaseAssignmentRole.TrialAttorney,
        }),
      ]),
    );
    expect(clairAssignments).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ name: perryMason })]),
    );
    expect(clairAssignments).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ name: benMatlock })]),
    );

    expect(benAssignments.length).toEqual(2);
    expect(benAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caseId: caseNumberOne,
          name: benMatlock,
          role: CaseAssignmentRole.TrialAttorney,
        }),
        expect.objectContaining({
          caseId: caseNumberThree,
          name: benMatlock,
          role: CaseAssignmentRole.TrialAttorney,
        }),
      ]),
    );
    expect(benAssignments).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ name: perryMason })]),
    );
    expect(benAssignments).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ name: clairHuxtable })]),
    );
  });
});
