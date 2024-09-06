import { CaseAssignmentController } from './case.assignment.controller';
import {
  THROW_PERMISSIONS_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../../testing/testing-constants';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { CaseAssignmentUseCase } from '../../use-cases/case-assignment';
import { CamsError } from '../../common-errors/cams-error';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { MANHATTAN } from '../../../../../common/src/cams/test-utilities/offices.mock';
import { UnknownError } from '../../common-errors/unknown-error';
import HttpStatusCodes from '../../../../../common/src/api/http-status-codes';
import { httpSuccess } from '../../adapters/utils/http-response';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';

const Jane = MockData.getCamsUserReference({ name: 'Jane' });
const Adrian = MockData.getCamsUserReference({ name: 'Adrian' });
const Tom = MockData.getCamsUserReference({ name: 'Tom' });

describe('Case Assignment Creation Tests', () => {
  const trialAttorneyRole = CamsRole.TrialAttorney;
  let applicationContext;

  const user = {
    ...MockData.getCamsUserReference(),
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
    const listOfAttorneyNames = [Jane];
    const testCaseAssignment = {
      caseId: '081-18-12345',
      attorneyList: listOfAttorneyNames,
      role: 'TrialAttorney',
    };
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { id: '081-18-12345' },
      body: testCaseAssignment,
    });

    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse = await assignmentController.handleRequest(applicationContext);

    expect(assignmentResponse.statusCode).toEqual(HttpStatusCodes.CREATED);
    expect(assignmentResponse.body).toBeUndefined();
  });

  test('should assign all attorneys in the list', async () => {
    const listOfAttorneyNames = [Jane, Tom, Adrian];
    const testCaseAssignment = {
      caseId: '081-18-12345',
      listOfAttorneyNames,
      role: trialAttorneyRole,
    };
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { id: '081-18-12345' },
      body: testCaseAssignment,
    });
    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse = await assignmentController.handleRequest(applicationContext);

    expect(assignmentResponse.statusCode).toEqual(HttpStatusCodes.CREATED);
    expect(assignmentResponse.body).toBeUndefined();
  });

  test('should create only one assignment per attorney', async () => {
    const listOfAttorneys: CamsUserReference[] = [Jane, Tom, Jane, Adrian, Tom];
    const testCaseAssignment = {
      caseId: '081-18-12345',
      listOfAttorneyNames: listOfAttorneys,
      role: trialAttorneyRole,
    };
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { id: '081-18-12345' },
      body: testCaseAssignment,
    });
    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse = await assignmentController.handleRequest(applicationContext);

    expect(assignmentResponse.statusCode).toEqual(HttpStatusCodes.CREATED);
    expect(assignmentResponse.body).toBeUndefined();
  });

  test('should fetch a list of assignments when a GET request is called', async () => {
    const assignments = MockData.buildArray(MockData.getAttorneyAssignment, 3);
    const camsHttpResponse = httpSuccess({ body: { data: assignments } });
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId')
      .mockResolvedValue(assignments);

    const assignmentController = new CaseAssignmentController(applicationContext);
    const result = await assignmentController.handleRequest(applicationContext);
    expect(result).toEqual(camsHttpResponse);
  });

  test('should rethrow CAMS errors on findAssignmentsByCaseId', async () => {
    const errorMessage = 'A CAMS error';
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId')
      .mockRejectedValue(new CamsError('TEST', { message: errorMessage }));
    const assignmentController = new CaseAssignmentController(applicationContext);

    await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(
      errorMessage,
    );
  });

  test('should throw a CAMS permission error', async () => {
    const testCaseAssignment = {
      caseId: THROW_PERMISSIONS_ERROR_CASE_ID,
      listOfAttorneyNames: [],
      role: trialAttorneyRole,
    };
    const mockContext = await createMockApplicationContext();
    mockContext.session = await createMockApplicationContextSession();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { id: THROW_UNKNOWN_ERROR_CASE_ID },
      body: testCaseAssignment,
    });
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId')
      .mockRejectedValue(new ForbiddenError('TEST_MODULE', { message: 'forbidden' }));

    const assignmentController = new CaseAssignmentController(mockContext);
    await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(
      'User does not have appropriate access to create assignments for this office.',
    );
  });

  test('should throw any other errors on findAssignmentsByCaseId', async () => {
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId')
      .mockRejectedValue(new Error());
    const assignmentController = new CaseAssignmentController(applicationContext);

    await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(
      'Unknown error',
    );
  });

  test('should throw an UnknownError when an error that is not a CamsError is caught', async () => {
    const error = new UnknownError('TEST-MODULE');
    jest
      .spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments')
      .mockRejectedValue(error);
    const testCaseAssignment = {
      caseId: THROW_UNKNOWN_ERROR_CASE_ID,
      listOfAttorneyNames: [],
      role: CamsRole.TrialAttorney,
    };
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { id: THROW_UNKNOWN_ERROR_CASE_ID },
      body: testCaseAssignment,
    });
    const assignmentController = new CaseAssignmentController(applicationContext);

    await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(error);
  });
});
