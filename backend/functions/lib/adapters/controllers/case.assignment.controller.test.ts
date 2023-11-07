import { CaseAssignmentController } from './case.assignment.controller';
import { AttorneyAssignmentResponseInterface } from '../types/case.assignment';
import { applicationContextCreator } from '../utils/application-context-creator';
const functionContext = require('azure-function-context-mock');

describe('Case Assignment Creation Tests', () => {
  const env = process.env;
  const trialAttorneyRole = 'TrialAttorney';
  let applicationContext;
  beforeEach(async () => {
    applicationContext = await applicationContextCreator(functionContext);
    process.env = {
      ...env,
      DATABASE_MOCK: 'true',
    };
  });

  // TODO: figure out a way to test exceptional behavior

  test('A case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = {
      caseId: '001-18-12345',
      listOfAttorneyNames: ['Jane'],
      role: trialAttorneyRole,
    };

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    const assignmentController = new CaseAssignmentController(applicationContext);
    try {
      assignmentResponse =
        await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }

    expect(assignmentResponse.body.length).toBe(1);
    expect(assignmentResponse.body[0]).toBeTruthy();
  });

  test('should assign all attorneys in the list', async () => {
    const listOfAttorneyNames = ['Jane', 'Tom', 'Adrian'];
    const testCaseAssignment = {
      caseId: '001-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    let assignmentResponse: AttorneyAssignmentResponseInterface;
    const assignmentController = new CaseAssignmentController(applicationContext);
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
    const assignmentController = new CaseAssignmentController(applicationContext);
    try {
      assignmentResponse =
        await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
    } catch (exception) {
      // exception.message;
    }

    expect(assignmentResponse.body.length).toBe(3);
  });
});
