import handler from './case.assignment.function';
import { CaseAssignmentController } from '../lib/controllers/case-assignment/case.assignment.controller';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AssignmentError } from '../lib/use-cases/assignment.exception';
import { UnknownError } from '../lib/common-errors/unknown-error';
import ContextCreator from '../azure/application-context-creator';
import { CaseAssignment } from '../../../common/src/cams/assignments';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest } from '../azure/functions';
import { CamsRole } from '../../../common/src/cams/roles';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsHttpRequest } from '../lib/adapters/types/http';
import { InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';

describe('Case Assignment Function Tests', () => {
  const defaultRequestProps: Partial<CamsHttpRequest> = {
    method: 'POST',
    body: {
      caseId: '081-67-89123',
      attorneyList: ['Bob Bob'],
      role: 'TrialAttorney',
    },
  };

  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

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

  test('Return the function response with the assignment Id created for the new case assignment', async () => {
    const expectedData = ['id-1', 'id-2'];
    jest
      .spyOn(CaseAssignmentController.prototype, 'createTrialAttorneyAssignments')
      .mockResolvedValue({
        body: expectedData,
      });

    const request = createMockAzureFunctionRequest(defaultRequestProps);
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedData);
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

      const request = createMockAzureFunctionRequest({
        ...defaultRequestProps,
        ...requestOverride,
      });

      const expectedResponse = {
        message,
        success: false,
      };

      const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
      const response = await handler(request, context);
      expect(response.jsonBody).toEqual(expectedResponse);
      expect(response.status).toEqual(400);
      expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
      expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
    },
  );

  test('Should return an HTTP Error if the controller throws an error during assignment creation', async () => {
    const appContext = await createMockApplicationContext();
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(appContext);
    jest
      .spyOn(Object.getPrototypeOf(assignmentController), 'createTrialAttorneyAssignments')
      .mockImplementation(() => {
        throw new Error();
      });

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

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const response = await handler(request, context);

    expect(httpErrorSpy).toHaveBeenCalled();
    expect(response.status).toEqual(500);
    expect(response.jsonBody.message).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
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
