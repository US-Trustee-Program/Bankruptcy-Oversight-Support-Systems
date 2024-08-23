import { handler } from './case.assignment.function';
import { CaseAssignmentController } from '../lib/controllers/case-assignment/case.assignment.controller';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AssignmentError } from '../lib/use-cases/assignment.exception';
import { UnknownError } from '../lib/common-errors/unknown-error';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
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
    const request = createMockAzureFunctionRequest(defaultRequestProps);
    const expectedResponse = {
      success: true,
      message: 'Trial attorney assignments created.',
      count: 1,
    };
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expect.objectContaining(expectedResponse));
    expect(response.jsonBody.body.length).toEqual(1);
  });

  test('returns response with multiple assignment Ids , when requested to create assignments for multiple trial attorneys on a case', async () => {
    const requestOverride = {
      body: {
        caseId: '081-67-89123',
        attorneyList: ['John', 'Rachel'],
        role: 'TrialAttorney',
      },
    };
    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });
    const expectedResponse = {
      success: true,
      message: 'Trial attorney assignments created.',
      count: 2,
    };

    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expect.objectContaining(expectedResponse));
    expect(response.jsonBody.body.length).toEqual(2);
  });

  test('handle any duplicate attorneys passed in the request, not create duplicate assignments', async () => {
    const requestOverride = {
      body: {
        caseId: '081-67-89123',
        attorneyList: ['Jane', 'Jane'],
        role: 'TrialAttorney',
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedResponse = {
      success: true,
      message: 'Trial attorney assignments created.',
      count: 1,
    };

    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expect.objectContaining(expectedResponse));
    expect(response.jsonBody.body.length).toEqual(1);
  });

  test('returns bad request 400 when a caseId is not passed in the request', async () => {
    const requestOverride = {
      body: {
        caseId: '',
        attorneyList: ['Bob', 'Denise'],
        role: 'TrialAttorney',
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedResponse = {
      message: 'Required parameter(s) caseId is/are absent.',
      success: false,
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedResponse);
    expect(response.status).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a caseId is invalid format', async () => {
    const requestOverride = {
      body: {
        caseId: '123',
        attorneyList: ['Bob', 'Denise'],
        role: 'TrialAttorney',
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedResponse = { message: 'caseId must be formatted like 01-12345.', success: false };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedResponse);
    expect(response.status).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a role is not passed in the request', async () => {
    const requestOverride = {
      body: {
        caseId: '001-90-90123',
        attorneyList: ['John Doe'],
        role: '',
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedResponse = {
      message:
        'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment. Required parameter(s) role is/are absent.',
      success: false,
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedResponse);
    expect(response.status).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a role of TrialAttorney is not passed in the request', async () => {
    const requestOverride = {
      body: {
        caseId: '001-90-90123',
        attorneyList: ['John Doe'],
        role: 'TrialDragon',
      },
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedResponse = {
      message:
        'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment.',
      success: false,
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedResponse);
    expect(response.status).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

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
