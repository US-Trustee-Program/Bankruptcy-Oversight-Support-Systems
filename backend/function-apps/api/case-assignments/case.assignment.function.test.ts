import { vi } from 'vitest';
import handler from './case.assignment.function';
import { CaseAssignmentController } from '../../../lib/controllers/case-assignment/case.assignment.controller';
import ContextCreator from '../../azure/application-context-creator';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import { InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';

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
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getManhattanAssignmentManagerSession(),
    );
    context = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('Return the function response with the assignment Id created for the new case assignment', async () => {
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess(undefined, {
      statusCode: HttpStatusCodes.CREATED,
    });
    vi.spyOn(CaseAssignmentController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );

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
      vi.spyOn(CaseAssignmentController.prototype, 'handleRequest').mockRejectedValue(error);

      const response = await handler(request, context);
      expect(response).toEqual(azureHttpResponse);
    },
  );

  test('Should return an HTTP Error if the controller throws an error during assignment creation', async () => {
    const error = new UnknownError('MOCK_CASE_ASSIGNMENT_MODULE');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(CaseAssignmentController.prototype, 'handleRequest').mockRejectedValue(error);

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

    const getAssignmentRequestSpy = vi
      .spyOn(Object.getPrototypeOf(assignmentController), 'handleRequest')
      .mockReturnValue(assignments);
    await handler(request, context);

    expect(getAssignmentRequestSpy).toHaveReturnedWith(assignments);
  });
});
