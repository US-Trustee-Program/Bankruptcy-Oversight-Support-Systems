import { CaseAssignmentController } from './case.assignment.controller';
import { applicationContextCreator } from '../utils/application-context-creator';
import { THROW_PERMISSIONS_ERROR_CASE_ID } from '../../testing/testing-constants';

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

  test('A case is assigned to an attorney when requested', async () => {
    const testCaseAssignment = {
      caseId: '001-18-12345',
      listOfAttorneyNames: ['Jane'],
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);

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

    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);

    expect(assignmentResponse.body.length).toBe(listOfAttorneyNames.length);
  });

  test('should create only one assignment per attorney', async () => {
    const listOfAttorneyNames = ['Jane', 'Tom', 'Jane', 'Adrian', 'Tom'];
    const testCaseAssignment = {
      caseId: '001-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);

    expect(assignmentResponse.body.length).toBe(3);
  });

  test('should throw a CAMS permission error', async () => {
    const testCaseAssignment = {
      caseId: THROW_PERMISSIONS_ERROR_CASE_ID,
      listOfAttorneyNames: [],
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(applicationContext);

    await expect(
      assignmentController.createTrialAttorneyAssignments(testCaseAssignment),
    ).rejects.toThrow('Failed to authenticate to Azure');
  });
});
