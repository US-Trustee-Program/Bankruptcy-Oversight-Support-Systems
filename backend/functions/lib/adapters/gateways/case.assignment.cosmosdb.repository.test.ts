import { CaseAssignmentCosmosDbRepository } from './case.assignment.cosmosdb.repository';
import { randomUUID } from 'crypto';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignment, CaseAssignmentHistory } from '../types/case.assignment';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CASE_HISTORY } from '../../testing/mock-data/case-history.mock';
import {
  THROW_PERMISSIONS_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../../testing/testing-constants';

describe('Test case assignment cosmosdb repository tests', () => {
  const currentDate = new Date().toISOString();
  const perryMason = 'Perry Mason';
  const benMatlock = 'Ben Matlock';
  const clairHuxtable = 'Clair Huxtable';
  const trialAttorneyRole = 'TrialAttorney';
  let repository: CaseAssignmentCosmosDbRepository;

  beforeEach(async () => {
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    repository = new CaseAssignmentCosmosDbRepository(applicationContext);
  });

  test('should create two assignments and find both of them', async () => {
    const caseId = randomUUID();

    const testCaseAttorneyAssignment1: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseId,
      name: clairHuxtable,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };
    const testCaseAttorneyAssignment2: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId,
      name: perryMason,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };

    const assignmentId1 = await repository.createAssignment(testCaseAttorneyAssignment1);
    const assignmentId2 = await repository.createAssignment(testCaseAttorneyAssignment2);

    expect(assignmentId1).toBeTruthy();
    expect(assignmentId2).toBeTruthy();

    const actualAssignments = await repository.findAssignmentsByCaseId(caseId);

    expect(actualAssignments.length).toEqual(2);

    const assignment1 = actualAssignments.find((assign) => assign.id === assignmentId1);
    const assignment2 = actualAssignments.find((assign) => assign.id === assignmentId2);

    expect(assignment1.caseId).toEqual(testCaseAttorneyAssignment1.caseId);
    expect(assignment1.role).toEqual(CaseAssignmentRole.TrialAttorney);
    expect(assignment1.name).toEqual(testCaseAttorneyAssignment1.name);
    expect(assignment2.caseId).toEqual(testCaseAttorneyAssignment2.caseId);
    expect(assignment2.role).toEqual(CaseAssignmentRole.TrialAttorney);
    expect(assignment2.name).toEqual(testCaseAttorneyAssignment2.name);
  });

  test('should update existing assignment record', async () => {
    const caseId = randomUUID();

    const testCaseAttorneyAssignment: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseId,
      name: clairHuxtable,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };

    const actualIdResponse = await repository.createAssignment(testCaseAttorneyAssignment);
    expect(actualIdResponse).toBeTruthy();

    testCaseAttorneyAssignment.id = actualIdResponse;
    testCaseAttorneyAssignment.unassignedOn = new Date().toISOString();
    const actualIdUpdateResponse = await repository.updateAssignment(testCaseAttorneyAssignment);

    expect(actualIdUpdateResponse).toEqual(actualIdResponse);
  });

  test('should throw a permissions exception when user doesnt have permission to update an assignment', async () => {
    const caseId = randomUUID();

    const existingCaseAttorneyAssignment: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseId,
      name: clairHuxtable,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };

    await repository.createAssignment(existingCaseAttorneyAssignment);

    const testCaseAttorneyAssignment: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: THROW_PERMISSIONS_ERROR_CASE_ID,
      name: benMatlock,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };

    await expect(repository.updateAssignment(testCaseAttorneyAssignment)).rejects.toThrow(
      'Unable to update assignment. Please try again later. If the problem persists, please contact USTP support.',
    );
  });

  test('should find only assignments for the requested case', async () => {
    const caseIdOne = randomUUID();
    const caseIdTwo = randomUUID();
    const testCaseAttorneyAssignment1: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseIdOne,
      name: clairHuxtable,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };
    const testCaseAttorneyAssignment2: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseIdTwo,
      name: perryMason,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };

    const assignmentId1 = await repository.createAssignment(testCaseAttorneyAssignment1);
    const assignmentId2 = await repository.createAssignment(testCaseAttorneyAssignment2);

    const actualAssignmentsOne = await repository.findAssignmentsByCaseId(caseIdOne);

    expect(actualAssignmentsOne.length).toEqual(1);

    const assignment1 = actualAssignmentsOne.find((assign) => assign.id === assignmentId1);
    const assignment2 = actualAssignmentsOne.find((assign) => assign.id === assignmentId2);

    expect(assignment1.caseId).toEqual(testCaseAttorneyAssignment1.caseId);
    expect(assignment1.role).toEqual(CaseAssignmentRole.TrialAttorney);
    expect(assignment1.name).toEqual(testCaseAttorneyAssignment1.name);
    expect(assignment2).toBeFalsy();

    const actualAssignmentsTwo = await repository.findAssignmentsByCaseId(caseIdTwo);

    expect(actualAssignmentsOne.length).toEqual(1);

    const assignmentOne = actualAssignmentsTwo.find((assign) => assign.id === assignmentId1);
    const assignmentTwo = actualAssignmentsTwo.find((assign) => assign.id === assignmentId2);

    expect(assignmentTwo.caseId).toEqual(testCaseAttorneyAssignment2.caseId);
    expect(assignmentTwo.role).toEqual(CaseAssignmentRole.TrialAttorney);
    expect(assignmentTwo.name).toEqual(testCaseAttorneyAssignment2.name);
    expect(assignmentOne).toBeFalsy();
  });

  test('Throws a permissions exception when user doesnt have permission to create an assignment', async () => {
    const testCaseAttorneyAssignment: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: THROW_PERMISSIONS_ERROR_CASE_ID,
      name: benMatlock,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };

    await expect(repository.createAssignment(testCaseAttorneyAssignment)).rejects.toThrow(
      'Unable to create assignment. Please try again later. If the problem persists, please contact USTP support.',
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

  test('Should throw AggregateAuthentication Error for authentication errors from credentials', async () => {
    try {
      await repository.findAssignmentsByCaseId(THROW_PERMISSIONS_ERROR_CASE_ID);
      expect(true).toBeFalsy();
    } catch (e) {
      expect((e as Error).message).toEqual('Failed to authenticate to Azure');
    }
  });

  test('should find all assignments for a given attorney', async () => {
    const caseIdOne = randomUUID();
    const testCaseAttorneyAssignment1: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseIdOne,
      name: perryMason,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };
    const testCaseAttorneyAssignment2: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseIdOne,
      name: benMatlock,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };

    const caseIdTwo = randomUUID();
    const testCaseAttorneyAssignment3: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseIdTwo,
      name: clairHuxtable,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };
    const testCaseAttorneyAssignment4: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseIdTwo,
      name: perryMason,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };

    const caseIdThree = randomUUID();
    const testCaseAttorneyAssignment5: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseIdThree,
      name: clairHuxtable,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };
    const testCaseAttorneyAssignment6: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseIdThree,
      name: benMatlock,
      role: CaseAssignmentRole[trialAttorneyRole],
      assignedOn: currentDate,
    };

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
          caseId: caseIdOne,
          name: perryMason,
          role: CaseAssignmentRole.TrialAttorney,
        }),
        expect.objectContaining({
          caseId: caseIdTwo,
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
          caseId: caseIdTwo,
          name: clairHuxtable,
          role: CaseAssignmentRole.TrialAttorney,
        }),
        expect.objectContaining({
          caseId: caseIdThree,
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
          caseId: caseIdOne,
          name: benMatlock,
          role: CaseAssignmentRole.TrialAttorney,
        }),
        expect.objectContaining({
          caseId: caseIdThree,
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

  test('When creating an assignment, Should throw Unknown Error if an unknown error occurs', async () => {
    const caseId = THROW_UNKNOWN_ERROR_CASE_ID;

    const existingCaseAttorneyAssignment: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      caseId: caseId,
      name: clairHuxtable,
      role: CaseAssignmentRole.TrialAttorney,
      assignedOn: currentDate,
    };

    await expect(repository.createAssignment(existingCaseAttorneyAssignment)).rejects.toThrow(
      'Unable to create assignment. Please try again later. If the problem persists, please contact USTP support.',
    );
  });

  test('When updating an assignment, Should throw Unknown Error if an unknown error occurs', async () => {
    const testCaseAttorneyAssignment: CaseAssignment = {
      documentType: 'ASSIGNMENT',
      id: 'some-id',
      caseId: THROW_UNKNOWN_ERROR_CASE_ID,
      name: benMatlock,
      role: CaseAssignmentRole.TrialAttorney,
      assignedOn: currentDate,
    };

    await expect(repository.updateAssignment(testCaseAttorneyAssignment)).rejects.toThrow(
      'Unable to update assignment. Please try again later. If the problem persists, please contact USTP support.',
    );
  });

  describe('Test case history cosmosdb repository tests', () => {
    test('should return case history for attorney assignments', async () => {
      const caseId = '123-11-1234';
      const actualAssignmentsOne = await repository.getAssignmentHistory(caseId);

      expect(actualAssignmentsOne.length).toEqual(2);
      expect(actualAssignmentsOne).toEqual(CASE_HISTORY);
    });

    test('should throw a permissions error when user doesnt have permission to create assignment history', async () => {
      const caseId = THROW_PERMISSIONS_ERROR_CASE_ID;
      const testCaseAssignmentHistory: CaseAssignmentHistory = {
        caseId,
        documentType: 'ASSIGNMENT_HISTORY',
        occurredAtTimestamp: new Date().toISOString(),
        previousAssignments: [],
        newAssignments: [],
      };

      await expect(repository.createAssignmentHistory(testCaseAssignmentHistory)).rejects.toThrow(
        'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
      );
    });

    test('should throw UnknownError if an unknown error occurs', async () => {
      const caseId = THROW_UNKNOWN_ERROR_CASE_ID;
      const testCaseAssignmentHistory: CaseAssignmentHistory = {
        caseId,
        documentType: 'ASSIGNMENT_HISTORY',
        occurredAtTimestamp: new Date().toISOString(),
        previousAssignments: [],
        newAssignments: [],
      };

      await expect(repository.createAssignmentHistory(testCaseAssignmentHistory)).rejects.toThrow(
        'Unable to create assignment history. Please try again later. If the problem persists, please contact USTP support.',
      );
    });
  });
});
