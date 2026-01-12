import { vi } from 'vitest';
import { CaseAssignmentController } from './case.assignment.controller';
import {
  THROW_PERMISSIONS_ERROR_CASE_ID,
  THROW_UNKNOWN_ERROR_CASE_ID,
} from '../../testing/testing-constants';
import MockData from '@common/cams/test-utilities/mock-data';
import { CaseAssignmentUseCase } from '../../use-cases/case-assignment/case-assignment';
import { CamsError } from '../../common-errors/cams-error';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { CamsUserReference } from '@common/cams/users';
import { UnknownError } from '../../common-errors/unknown-error';
import HttpStatusCodes from '@common/api/http-status-codes';
import { httpSuccess } from '../../adapters/utils/http-response';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { REGION_02_GROUP_NY } from '@common/cams/test-utilities/mock-user';
import { ApplicationContext } from '../../adapters/types/basic';

const Jane = MockData.getCamsUserReference({ name: 'Jane' });
const Adrian = MockData.getCamsUserReference({ name: 'Adrian' });
const Tom = MockData.getCamsUserReference({ name: 'Tom' });

describe('Case Assignment Creation Tests', () => {
  const trialAttorneyRole = CamsRole.TrialAttorney;
  let applicationContext: ApplicationContext;

  const user = {
    ...MockData.getCamsUserReference(),
    name: 'Mock Name',
    offices: [REGION_02_GROUP_NY],
    roles: [CamsRole.CaseAssignmentManager],
  };

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
    applicationContext.session = await createMockApplicationContextSession({ user });
  });

  afterEach(() => {
    vi.resetAllMocks();
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
    vi.spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments').mockResolvedValue();

    const assignmentController = new CaseAssignmentController(applicationContext);
    const assignmentResponse = await assignmentController.handleRequest(applicationContext);

    expect(assignmentResponse.statusCode).toEqual(HttpStatusCodes.CREATED);
    expect(assignmentResponse.body).toBeUndefined();
  });

  test('should identify a singular missing parameter', async () => {
    const listOfAttorneys: CamsUserReference[] = [Jane, Tom, Jane, Adrian, Tom];
    const testCaseAssignment = {
      caseId: undefined,
      listOfAttorneyNames: listOfAttorneys,
      role: CamsRole.TrialAttorney,
    };
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: undefined,
      body: testCaseAssignment,
    });
    const assignmentController = new CaseAssignmentController(applicationContext);
    await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameter caseId is absent.',
    );
  });

  test('should identify plural missing parameters', async () => {
    const listOfAttorneys: CamsUserReference[] = [Jane, Tom, Jane, Adrian, Tom];
    const testCaseAssignment = {
      caseId: undefined,
      listOfAttorneyNames: listOfAttorneys,
      role: undefined,
    };
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: undefined,
      body: testCaseAssignment,
    });
    const assignmentController = new CaseAssignmentController(applicationContext);
    await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameters caseId, role are absent.',
    );
  });

  test('should identify invalid case id', async () => {
    const listOfAttorneys: CamsUserReference[] = [Jane, Tom, Jane, Adrian, Tom];
    const testCaseAssignment = {
      caseId: 'hello',
      listOfAttorneyNames: listOfAttorneys,
      role: CamsRole.TrialAttorney,
    };
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { id: 'bogus-id' },
      body: testCaseAssignment,
    });
    const assignmentController = new CaseAssignmentController(applicationContext);
    await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(
      'caseId must be formatted like 01-12345.',
    );
  });

  const roleTestCases = [
    'bad-role',
    CamsRole.DataVerifier,
    CamsRole.CaseAssignmentManager,
    CamsRole.PrivilegedIdentityUser,
    CamsRole.SuperUser,
  ];
  test.each(roleTestCases)(
    'should identify a bad role assignment for %s role',
    async (role: string) => {
      const listOfAttorneys: CamsUserReference[] = [Jane, Tom, Jane, Adrian, Tom];
      const testCaseAssignment = {
        caseId: '081-18-12345',
        listOfAttorneyNames: listOfAttorneys,
        role,
      };
      applicationContext.request = mockCamsHttpRequest({
        method: 'POST',
        params: { id: '081-18-12345' },
        body: testCaseAssignment,
      });
      const assignmentController = new CaseAssignmentController(applicationContext);
      await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(
        'The provided role is not an assignable role.',
      );
    },
  );

  test('should fetch a list of assignments when a GET request is called', async () => {
    const caseId = '111-22-33333';
    const assignments = MockData.buildArray(() => MockData.getAttorneyAssignment({ caseId }), 3);
    const camsHttpResponse = httpSuccess({ body: { data: assignments } });
    const expectedMap = new Map([[caseId, assignments]]);
    applicationContext.request = mockCamsHttpRequest({
      method: 'GET',
      params: { id: caseId },
    });

    vi.spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId').mockResolvedValue(
      expectedMap,
    );

    const assignmentController = new CaseAssignmentController(applicationContext);
    const result = await assignmentController.handleRequest(applicationContext);
    expect(result).toEqual(camsHttpResponse);
  });

  test('should rethrow CAMS errors on findAssignmentsByCaseId', async () => {
    const errorMessage = 'A CAMS error';
    vi.spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId').mockRejectedValue(
      new CamsError('TEST', { message: errorMessage }),
    );
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
    vi.spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments').mockRejectedValue(
      new ForbiddenError('TEST_MODULE', { message: 'forbidden' }),
    );

    const assignmentController = new CaseAssignmentController(mockContext);
    await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(
      'forbidden',
    );
  });

  test('should throw any other errors on findAssignmentsByCaseId', async () => {
    vi.spyOn(CaseAssignmentUseCase.prototype, 'findAssignmentsByCaseId').mockRejectedValue(
      new Error(),
    );
    const assignmentController = new CaseAssignmentController(applicationContext);

    await expect(assignmentController.handleRequest(applicationContext)).rejects.toThrow(
      'Unknown Error',
    );
  });

  test('should throw an UnknownError when an error that is not a CamsError is caught', async () => {
    const error = new UnknownError('TEST-MODULE');
    vi.spyOn(CaseAssignmentUseCase.prototype, 'createTrialAttorneyAssignments').mockRejectedValue(
      error,
    );
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
