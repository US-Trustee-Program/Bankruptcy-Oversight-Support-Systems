import { CaseAssignmentRole } from '../types/case.assignment.role';
import { CaseAssignmentController } from './case.assignment.controller';
import { AttorneyAssignmentResponseInterface } from '../types/case.assignment';
import { AssignmentException } from '../../use-cases/assignment.exception';

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
      listOfAttorneyNames: ['Jane'],
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

    expect(assignmentResponse.body.length).toBe(1);
    expect(assignmentResponse.body[0]).toBeTruthy();
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

    await expect(
      assignmentController.createTrialAttorneyAssignments(testCaseAssignment2),
    ).rejects.toThrow(AssignmentException);
  });

  test('should assign all attorneys in the list', async () => {
    const listOfAttorneyNames = ['Jane', 'Tom', 'Adrian'];
    const testCaseAssignment = {
      caseId: '18-12345',
      listOfAttorneyNames,
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

    expect(assignmentResponse.body.length).toBe(listOfAttorneyNames.length);
  });

  test('should create only one assignment per attorney', async () => {
    const listOfAttorneyNames = ['Jane', 'Tom', 'Jane', 'Adrian', 'Tom'];
    const testCaseAssignment = {
      caseId: '18-12345',
      listOfAttorneyNames,
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

    expect(assignmentResponse.body.length).toBe(3);
  });
});
