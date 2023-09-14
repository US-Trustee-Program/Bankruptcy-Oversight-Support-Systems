import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentController } from './case.assignment.controller';
import { AttorneyAssignmentResponseInterface } from '../types/case.assignment';
import { AssignmentException } from '../../use-cases/assignment.exception';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
const context = require('azure-function-context-mock');

describe('Chapter 15 Case Assignment Creation Tests', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      DATABASE_MOCK: 'true',
    };
  });

  test('A chapter 15 case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = {
      caseId: '18-12345',
      listOfAttorneyNames: ['Jane '],
      role: CaseAssignmentRole.TrialAttorney,
    };

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    const assignmentController = new CaseAssignmentController(context);
    try {
      assignmentResponse =
        await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }
    const resultAssignmentId = assignmentResponse.body[0];

    const assignments = await assignmentController.getAllAssignments();

    expect(resultAssignmentId).toBeTruthy();
    expect((assignments.body[0] as CaseAttorneyAssignment).caseId).toBe(testCaseAssignment.caseId);
    expect((assignments.body[0] as CaseAttorneyAssignment).name).toBe(
      testCaseAssignment.listOfAttorneyNames[0],
    );
    expect((assignments.body[0] as CaseAttorneyAssignment).role).toBe(testCaseAssignment.role);
  });

  test('should throw an assignment exception, if one already exists in the repository for the case', async () => {
    const testCaseAssignment = {
      caseId: '18-12345',
      listOfAttorneyNames: ['Jane'],
      role: CaseAssignmentRole.TrialAttorney,
    };

    const assignmentController = new CaseAssignmentController(context);

    try {
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
      expect(true).toBeFalsy();
    } catch (exception) {
      expect(exception.message).toEqual(
        'A trial attorney assignment already exists for this case. Cannot create another assignment on an existing case assignment.',
      );
    }
  });

  test('creating a new trial attorney assignment on a case with an existing assignment throws error', async () => {
    const testCaseAssignment1 = {
      caseId: '18-12345',
      listOfAttorneyNames: ['Jane'],
      role: CaseAssignmentRole.TrialAttorney,
    };

    const testCaseAssignment2 = {
      caseId: '18-12345',
      listOfAttorneyNames: ['John', 'Jane'],
      role: CaseAssignmentRole.TrialAttorney,
    };

    const assignmentController = new CaseAssignmentController(context);

    await assignmentController.createTrialAttorneyAssignments(testCaseAssignment1);

    const assignments = await assignmentController.getAllAssignments();
    const assignmentCreated1 = assignments.body[0] as CaseAttorneyAssignment;

    await expect(
      assignmentController.createTrialAttorneyAssignments(testCaseAssignment2),
    ).rejects.toThrow(AssignmentException);

    expect(assignmentCreated1.caseId).toBe(testCaseAssignment1.caseId);
    expect(assignmentCreated1.name).toBe(testCaseAssignment1.listOfAttorneyNames[0]);
    expect(assignmentCreated1.role).toBe(testCaseAssignment1.role);
  });

  test('A chapter 15 case is assigned to the list of trial attorneys provided.', async () => {
    const testCaseAssignment = {
      caseId: '18-12345',
      listOfAttorneyNames: ['Jane', 'Tom', 'Adrian'],
      role: CaseAssignmentRole.TrialAttorney,
    };

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    const assignmentController = new CaseAssignmentController(context);
    try {
      assignmentResponse =
        await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }

    expect(assignmentResponse.body.length).toBe(testCaseAssignment.listOfAttorneyNames.length);

    const assignments = await assignmentController.getAllAssignments();

    expect((assignments.body[0] as CaseAttorneyAssignment).caseId).toBe(testCaseAssignment.caseId);
    expect((assignments.body[0] as CaseAttorneyAssignment).name).toBe(
      testCaseAssignment.listOfAttorneyNames[0],
    );
    expect((assignments.body[0] as CaseAttorneyAssignment).role).toBe(testCaseAssignment.role);

    expect((assignments.body[1] as CaseAttorneyAssignment).caseId).toBe(testCaseAssignment.caseId);
    expect((assignments.body[1] as CaseAttorneyAssignment).name).toBe(
      testCaseAssignment.listOfAttorneyNames[1],
    );
    expect((assignments.body[1] as CaseAttorneyAssignment).role).toBe(testCaseAssignment.role);

    expect((assignments.body[2] as CaseAttorneyAssignment).caseId).toBe(testCaseAssignment.caseId);
    expect((assignments.body[2] as CaseAttorneyAssignment).name).toBe(
      testCaseAssignment.listOfAttorneyNames[2],
    );
    expect((assignments.body[2] as CaseAttorneyAssignment).role).toBe(testCaseAssignment.role);
  });
});
