import { CaseAssignmentController } from './case.assignment.controller';
import { AttorneyAssignmentResponseInterface } from '../types/case.assignment';
import { AssignmentError } from '../../use-cases/assignment.exception';
import { applicationContextCreator } from '../utils/application-context-creator';
const functionContext = require('azure-function-context-mock');

describe('Case Assignment Creation Tests', () => {
  const env = process.env;
  const trialAttorneyRole = 'TrialAttorney';
  let appContext;
  beforeEach(async () => {
    appContext = await applicationContextCreator(functionContext);
    process.env = {
      ...env,
      DATABASE_MOCK: 'true',
    };
  });

  test('A case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = {
      caseId: '001-18-12345',
      listOfAttorneyNames: ['Jane'],
      role: trialAttorneyRole,
    };

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    const assignmentController = new CaseAssignmentController(appContext);
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
      caseId: '001-18-12345',
      listOfAttorneyNames: ['Jane'],
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(appContext);

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
      caseId: '001-18-12345',
      listOfAttorneyNames: ['Jane'],
      role: trialAttorneyRole,
    };

    const testCaseAssignment2 = {
      caseId: '001-18-12345',
      listOfAttorneyNames: ['John', 'Jane'],
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(appContext);

    await assignmentController.createTrialAttorneyAssignments(testCaseAssignment1);

    await expect(
      assignmentController.createTrialAttorneyAssignments(testCaseAssignment2),
    ).rejects.toThrow(AssignmentError);
  });

  test('should assign all attorneys in the list', async () => {
    const listOfAttorneyNames = ['Jane', 'Tom', 'Adrian'];
    const testCaseAssignment = {
      caseId: '001-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    const assignmentController = new CaseAssignmentController(appContext);
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
      caseId: '001-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    const assignmentController = new CaseAssignmentController(appContext);
    try {
      assignmentResponse =
        await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }

    expect(assignmentResponse.body.length).toBe(3);
  });
});
