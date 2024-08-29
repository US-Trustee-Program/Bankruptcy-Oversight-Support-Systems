import handler from './case.assignment.function';
import { CaseAssignmentController } from '../lib/controllers/case-assignment/case.assignment.controller';
import ContextCreator from '../azure/application-context-creator';
import { CaseAssignment } from '../../../common/src/cams/assignments';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../common/src/cams/roles';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsHttpRequest } from '../lib/adapters/types/http';
import { InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../azure/testing-helpers';
import { CamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';

describe('Case Assignment Function Tests', () => {
  const defaultRequestProps: Partial<CamsHttpRequest> = {
    method: 'POST',
    body: {
      caseId: '081-67-89123',
      attorneyList: ['Bob Bob'],
      role: 'TrialAttorney',
    },
  };

  let context;

  beforeEach(() => {
    jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getCamsSession({
        user: {
          id: 'userId-Bob Jones',
          name: 'Bob Jones',
          offices: [MANHATTAN],
          roles: [CamsRole.CaseAssignmentManager],
        },
      }),
    );
    context = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  test('Return the function response with the assignment Id created for the new case assignment', async () => {
    const expectedData = { data: ['id-1', 'id-2'] };
    const { camsHttpResponse, azureHttpResponse } =
      buildTestResponseSuccess<string[]>(expectedData);
    jest
      .spyOn(CaseAssignmentController.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue(camsHttpResponse);

    const request = createMockAzureFunctionRequest(defaultRequestProps);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  const errorTestCases = [
    ['caseId not present', '', 'TrialAttorney', 'Required parameter(s) caseId is/are absent.'],
    ['invalid caseId format', '123', 'TrialAttorney', 'caseId must be formatted like 01-12345.'],
    [
      'role not present',
      '001-90-90123',
      '',
      'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment. Required parameter(s) role is/are absent.',
    ],
    [
      'invalid role',
      '001-90-90123',
      'TrialDragon',
      'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment.',
    ],
  ];
  test.each(errorTestCases)(
    'should return proper error response for %s',
    async (_caseName: string, caseId: string, role: string, message: string) => {
      const requestOverride = {
        body: {
          caseId,
          attorneyList: ['Bob', 'Denise'],
          role,
        },
      };
      const error = new CamsError('MOCK_CASE_ASSIGNMENT_MODULE', { message });
      const request = createMockAzureFunctionRequest({
        ...defaultRequestProps,
        ...requestOverride,
      });
      const { azureHttpResponse } = buildTestResponseError(error);
      jest
        .spyOn(CaseAssignmentController.prototype, 'createTrialAttorneyAssignments')
        .mockRejectedValue(error);

      const response = await handler(request, context);
      console.log('Response:   ', response);
      expect(response).toEqual(azureHttpResponse);
    },
  );

  test('Should return an HTTP Error if the controller throws an error during assignment creation', async () => {
    const error = new UnknownError('MOCK_CASE_ASSIGNMENT_MODULE');
    const { azureHttpResponse } = buildTestResponseError(error);
    jest
      .spyOn(CaseAssignmentController.prototype, 'createTrialAttorneyAssignments')
      .mockRejectedValue(error);

    const requestOverride = {
      body: {
        caseId: '001-67-89123',
        attorneyList: ['John Doe'],
        role: 'TrialAttorney',
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('Should call createAssignmentRequest with the request parameters, when passed to httpTrigger in the body', async () => {
    const caseId = '001-67-89012';
    const requestOverride = {
      body: { caseId: caseId, attorneyList: ['Jane Doe'], role: 'TrialAttorney' },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const appContext = await createMockApplicationContext();
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(appContext);
    const createAssignmentRequestSpy = jest.spyOn(
      Object.getPrototypeOf(assignmentController),
      'createTrialAttorneyAssignments',
    );
    await handler(request, context);

    expect(createAssignmentRequestSpy).toHaveBeenCalledWith(expect.objectContaining({ caseId }));
  });

  test('Should return a list of assignments when valid caseId is supplied for GET request', async () => {
    const caseId = '001-67-89012';
    const requestOverride: Partial<CamsHttpRequest> = {
      method: 'GET',
      params: {
        id: caseId,
      },
      body: undefined,
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const assignments: CaseAssignment[] = MockData.buildArray(MockData.getAttorneyAssignment, 3);

    const appContext = await createMockApplicationContext();
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(appContext);

    const getAssignmentRequestSpy = jest
      .spyOn(Object.getPrototypeOf(assignmentController), 'getTrialAttorneyAssignments')
      .mockReturnValue(assignments);
    await handler(request, context);

    expect(getAssignmentRequestSpy).toHaveBeenCalledWith(caseId);
    expect(getAssignmentRequestSpy).toHaveReturnedWith(assignments);
  });
});
