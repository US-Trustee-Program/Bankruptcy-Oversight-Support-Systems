import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentController } from './case.assignment.controller';
import { AttorneyAssignmentResponseInterface } from '../types/case.assignment';
import { AssignmentException } from '../../use-cases/assignment.exception';
const context = require('azure-function-context-mock');

describe('Chapter 15 Case Assignment Creation Tests', () => {
  test('A chapter 15 case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = {
      caseId: '12345',
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
    expect(assignments[0].caseId).toBe(testCaseAssignment.caseId);
    expect(assignments[0].attorneyName).toBe(testCaseAssignment.listOfAttorneyNames[0]);
    expect(assignments[0].role).toBe(testCaseAssignment.role);
  });

  test('should throw an assignment exception, if one already exists in the repository for the case', async () => {
    const testCaseAssignment = {
      caseId: '12345',
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
      caseId: '12345',
      listOfAttorneyNames: ['Jane'],
      role: CaseAssignmentRole.TrialAttorney,
    };

    const testCaseAssignment2 = {
      caseId: '12345',
      listOfAttorneyNames: ['John', 'Jane'],
      role: CaseAssignmentRole.TrialAttorney,
    };

    const assignmentController = new CaseAssignmentController(context);

    await assignmentController.createTrialAttorneyAssignments(testCaseAssignment1);

    const assignments = await assignmentController.getAllAssignments();
    const assignmentCreated1 = assignments[0];

    await expect(
      assignmentController.createTrialAttorneyAssignments(testCaseAssignment2),
    ).rejects.toThrow(AssignmentException);

    expect(assignmentCreated1.caseId).toBe(testCaseAssignment1.caseId);
    expect(assignmentCreated1.attorneyName).toBe(testCaseAssignment1.listOfAttorneyNames[0]);
    expect(assignmentCreated1.role).toBe(testCaseAssignment1.role);
  });

  test('A chapter 15 case is assigned to the list of trial attorneys provided.', async () => {
    const testCaseAssignment = {
      caseId: '12345',
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

    expect(assignments[0].caseId).toBe(testCaseAssignment.caseId);
    expect(assignments[0].attorneyName).toBe(testCaseAssignment.listOfAttorneyNames[0]);
    expect(assignments[0].role).toBe(testCaseAssignment.role);

    expect(assignments[1].caseId).toBe(testCaseAssignment.caseId);
    expect(assignments[1].attorneyName).toBe(testCaseAssignment.listOfAttorneyNames[1]);
    expect(assignments[1].role).toBe(testCaseAssignment.role);

    expect(assignments[2].caseId).toBe(testCaseAssignment.caseId);
    expect(assignments[2].attorneyName).toBe(testCaseAssignment.listOfAttorneyNames[2]);
    expect(assignments[2].role).toBe(testCaseAssignment.role);
  });
});
