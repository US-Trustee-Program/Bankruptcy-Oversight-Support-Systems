import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAssignmentLocalRepository } from './case.assignment.local.repository';
import { applicationContextCreator } from '../utils/application-context-creator';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { UnknownError } from '../../common-errors/unknown-error';
const context = require('azure-function-context-mock');

describe('Case Assignment Repository Tests', () => {
  test('Should persist case assignment', async () => {
    const applicationContext = await applicationContextCreator(context);
    const caseId = '123';
    const currentDate = new Date().toISOString();
    const testCaseAttorneyAssignment = {
      caseId,
      name: 'Susan Arbeit',
      role: CaseAssignmentRole['TrialAttorney'],
      assignedOn: currentDate,
    };
    const testCaseAssignmentLocalRepository: CaseAssignmentRepositoryInterface =
      new CaseAssignmentLocalRepository(applicationContext);

    await testCaseAssignmentLocalRepository.createAssignment(testCaseAttorneyAssignment);
    const actual = await testCaseAssignmentLocalRepository.findAssignmentsByCaseId(caseId);
    expect(actual[0]).toEqual(testCaseAttorneyAssignment);
  });

  test('Should update case assignment', async () => {
    const applicationContext = await applicationContextCreator(context);
    const localRepo: CaseAssignmentRepositoryInterface = new CaseAssignmentLocalRepository(
      applicationContext,
    );

    const caseId = '123';
    const currentDate = new Date().toISOString();
    const assignementToCreate = {
      caseId,
      name: 'Susan Arbeit',
      role: CaseAssignmentRole['TrialAttorney'],
      assignedOn: currentDate,
    };

    // First create a record to update.
    await localRepo.createAssignment(assignementToCreate);
    const created = await localRepo.findAssignmentsByCaseId(caseId);
    expect(created[0]).toEqual(assignementToCreate);

    // Then update the record.
    const assignmentToUpdate: CaseAttorneyAssignment = {
      ...assignementToCreate,
      unassignedOn: new Date().toISOString(),
    };
    await localRepo.updateAssignment(assignmentToUpdate);
    const updated = await localRepo.findAssignmentsByCaseId(caseId);
    expect(updated[0]).toEqual(assignmentToUpdate);
  });

  test('Should throw error if case is not found while updating', async () => {
    const applicationContext = await applicationContextCreator(context);
    const localRepo: CaseAssignmentRepositoryInterface = new CaseAssignmentLocalRepository(
      applicationContext,
    );

    const caseId = '123';
    const currentDate = new Date().toISOString();
    const assignment = {
      caseId,
      name: 'Susan Arbeit',
      role: CaseAssignmentRole['TrialAttorney'],
      assignedOn: currentDate,
      unassignedOn: new Date().toISOString(),
    };

    expect(async () => {
      await localRepo.updateAssignment(assignment);
    }).rejects.toThrow(
      new UnknownError('LOCAL-ASSIGNMENT-REPOSITORY', {
        message:
          'Unable to update assignment. Please try again later. If the problem persists, please contact USTP support.',
        originalError: new Error('Can not find record'),
        status: 500,
      }),
    );
  });

  test('Should return assignment by case id', async () => {
    const applicationContext = await applicationContextCreator(context);
    const localRepo: CaseAssignmentRepositoryInterface = new CaseAssignmentLocalRepository(
      applicationContext,
    );

    const caseId = '123';
    const currentDate = new Date().toISOString();
    const assignment = {
      caseId,
      name: 'Susan Arbeit',
      role: CaseAssignmentRole['TrialAttorney'],
      assignedOn: currentDate,
    };

    // First create a record to update.
    await localRepo.createAssignment(assignment);
    const created = await localRepo.findAssignmentsByCaseId(caseId);
    expect(created[0]).toEqual(assignment);

    const returned = await localRepo.getAssignment(created[0].id);
    expect(returned).toEqual(assignment);
  });

  test('Should return assignment by name', async () => {
    const applicationContext = await applicationContextCreator(context);
    const localRepo: CaseAssignmentRepositoryInterface = new CaseAssignmentLocalRepository(
      applicationContext,
    );

    const caseId = '123';
    const currentDate = new Date().toISOString();
    const assignment = {
      caseId,
      name: 'Susan Arbeit',
      role: CaseAssignmentRole['TrialAttorney'],
      assignedOn: currentDate,
    };

    // First create a record to lookup by name.
    await localRepo.createAssignment(assignment);
    const created = await localRepo.findAssignmentsByCaseId(caseId);
    expect(created[0]).toEqual(assignment);

    const returnedList = await localRepo.findAssignmentsByAssigneeName(assignment.name);
    expect(returnedList[0]).toEqual(assignment);
  });
});
