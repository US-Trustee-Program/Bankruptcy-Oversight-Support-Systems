import { CaseAssignmentController } from './case.assignment.controller';
import { THROW_PERMISSIONS_ERROR_CASE_ID } from '../../testing/testing-constants';
import { MANHATTAN, MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { CaseAssignmentUseCase } from '../../use-cases/case.assignment';
import { CamsError } from '../../common-errors/cams-error';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CamsRole } from '../../../../../common/src/cams/session';

describe('Case Assignment Creation Tests', () => {
  const trialAttorneyRole = 'TrialAttorney';
  let applicationContext;

  const user = {
    name: 'Mock Name',
    offices: [MANHATTAN],
    roles: [CamsRole.CaseAssignmentManager],
  };
  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
    applicationContext.session = await createMockApplicationContextSession({ user });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('A case is assigned to an attorney when requested', async () => {
    const listOfAttorneyNames = ['Jane'];
    const testCaseAssignment = {
      caseId: '081-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);

    expect(assignmentResponse.body.length).toBe(listOfAttorneyNames.length);
    expect(assignmentResponse).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Trial attorney assignments created.',
        count: listOfAttorneyNames.length,
        body: expect.any(Array<string>),
      }),
    );
  });

  test('should assign all attorneys in the list', async () => {
    const listOfAttorneyNames = ['Jane', 'Tom', 'Adrian'];
    const testCaseAssignment = {
      caseId: '081-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);

    expect(assignmentResponse.body.length).toBe(listOfAttorneyNames.length);
    expect(assignmentResponse).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Trial attorney assignments created.',
        count: listOfAttorneyNames.length,
        body: expect.any(Array<string>),
      }),
    );
  });

  test('should create only one assignment per attorney', async () => {
    const listOfAttorneyNames = ['Jane', 'Tom', 'Jane', 'Adrian', 'Tom'];
    const testCaseAssignment = {
      caseId: '081-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };

    const expectedNumberOfAssignees = Array.from(new Set(listOfAttorneyNames)).length;
    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);

    expect(assignmentResponse.body.length).toBe(expectedNumberOfAssignees);
    expect(assignmentResponse).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Trial attorney assignments created.',
        count: expectedNumberOfAssignees,
        body: expect.any(Array<string>),
      }),
    );
  });

  test('should fetch a list of assignments when a GET request is called', async () => {
    const assignments = MockData.buildArray(MockData.getAttorneyAssignment, 3);
    const assignmentResponse = {
      body: assignments,
      success: true,
    };
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId')
      .mockResolvedValue(assignments);

    const assignmentController = new CaseAssignmentController(applicationContext);
    const result = await assignmentController.getTrialAttorneyAssignments('081-18-12345');
    expect(result).toEqual(assignmentResponse);
  });

  test('should rethrow CAMS errors on findAssignmentsByCaseId', async () => {
    const errorMessage = 'A CAMS error';
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId')
      .mockRejectedValue(new CamsError('TEST', { message: errorMessage }));
    const assignmentController = new CaseAssignmentController(applicationContext);

    await expect(assignmentController.getTrialAttorneyAssignments('081-18-12345')).rejects.toThrow(
      errorMessage,
    );
  });

  test('should throw a CAMS permission error', async () => {
    const testCaseAssignment = {
      caseId: THROW_PERMISSIONS_ERROR_CASE_ID,
      listOfAttorneyNames: [],
      role: trialAttorneyRole,
    };
    const rejectedAssignmentResponse = {
      success: false,
      message: 'User does not have appropriate access to create assignments.',
      count: 0,
      body: [],
    };
    const mockContext = await createMockApplicationContext();
    mockContext.session = await createMockApplicationContextSession();

    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId')
      .mockRejectedValue(new ForbiddenError('TEST_MODULE', { message: 'forbidden' }));

    const assignmentController = new CaseAssignmentController(mockContext);
    const assignmentResponse =
      await assignmentController.createTrialAttorneyAssignments(testCaseAssignment);
    expect(assignmentResponse).toEqual(rejectedAssignmentResponse);
  });

  test('should throw any other errors on findAssignmentsByCaseId', async () => {
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId')
      .mockRejectedValue(new Error('An error'));
    const assignmentController = new CaseAssignmentController(applicationContext);

    await expect(assignmentController.getTrialAttorneyAssignments('081-18-12345')).rejects.toThrow(
      'Unknown error',
    );
  });
});
