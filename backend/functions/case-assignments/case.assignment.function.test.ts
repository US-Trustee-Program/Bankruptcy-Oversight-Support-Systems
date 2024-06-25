import httpTrigger from './case.assignment.function';
import { CaseAssignmentController } from '../lib/controllers/case-assignment/case.assignment.controller';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AssignmentError } from '../lib/use-cases/assignment.exception';
import { UnknownError } from '../lib/common-errors/unknown-error';
import * as ContextCreator from '../lib/adapters/utils/application-context-creator';
import { CaseAssignment } from '../../../common/src/cams/assignments';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest } from '../azure/functions';

describe('Case Assignment Function Tests', () => {
  //TODO?: process.env does not set properly in IntelliJ. why?
  const request = createMockAzureFunctionRequest({
    method: 'POST',
    query: {},
    body: {
      caseId: '001-67-89123',
      attorneyList: ['Bob Bob'],
      role: 'TrialAttorney',
    },
  });
  const context = require('azure-function-context-mock');

  beforeEach(async () => {
    jest
      .spyOn(ContextCreator, 'getApplicationContextSession')
      .mockResolvedValue(MockData.getCamsSession());
  });

  test('Return the function response with the assignment Id created for the new case assignment', async () => {
    const expectedResponse = {
      success: true,
      message: 'Trial attorney assignments created.',
      count: 1,
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expect.objectContaining(expectedResponse));
    expect(context.res.body.body.length).toEqual(1);
  });

  test('returns response with multiple assignment Ids , when requested to create assignments for multiple trial attorneys on a case', async () => {
    const requestOverride = {
      ...request,
      body: {
        caseId: '001-67-89123',
        attorneyList: ['John', 'Rachel'],
        role: 'TrialAttorney',
      },
    };
    const expectedResponse = {
      success: true,
      message: 'Trial attorney assignments created.',
      count: 2,
    };

    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expect.objectContaining(expectedResponse));
    expect(context.res.body.body.length).toEqual(2);
  });

  test('handle any duplicate attorneys passed in the request, not create duplicate assignments', async () => {
    const requestOverride = {
      ...request,
      body: {
        caseId: '001-67-89123',
        attorneyList: ['Jane', 'Jane'],
        role: 'TrialAttorney',
      },
    };

    const expectedResponse = {
      success: true,
      message: 'Trial attorney assignments created.',
      count: 1,
    };

    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expect.objectContaining(expectedResponse));
    expect(context.res.body.body.length).toEqual(1);
  });

  test('returns bad request 400 when a caseId is not passed in the request', async () => {
    const requestOverride = {
      ...request,
      body: {
        caseId: '',
        attorneyList: ['Bob', 'Denise'],
        role: 'TrialAttorney',
      },
    };

    const expectedResponse = {
      message: 'Required parameter(s) caseId is/are absent.',
      success: false,
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedResponse);
    expect(context.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a caseId is invalid format', async () => {
    const requestOverride = {
      ...request,
      body: {
        caseId: '123',
        attorneyList: ['Bob', 'Denise'],
        role: 'TrialAttorney',
      },
    };
    const expectedResponse = { message: 'caseId must be formatted like 01-12345.', success: false };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedResponse);
    expect(context.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a role is not passed in the request', async () => {
    const requestOverride = {
      ...request,
      body: {
        caseId: '001-90-90123',
        attorneyList: ['John Doe'],
        role: '',
      },
    };

    const expectedResponse = {
      message:
        'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment. Required parameter(s) role is/are absent.',
      success: false,
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedResponse);
    expect(context.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a role of TrialAttorney is not passed in the request', async () => {
    const requestOverride = {
      ...request,
      body: {
        caseId: '001-90-90123',
        attorneyList: ['John Doe'],
        role: 'TrialDragon',
      },
    };

    const expectedResponse = {
      message:
        'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment.',
      success: false,
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedResponse);
    expect(context.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('Should return an HTTP Error if the controller throws an error during assignment creation', async () => {
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(context);
    jest
      .spyOn(Object.getPrototypeOf(assignmentController), 'createTrialAttorneyAssignments')
      .mockImplementation(() => {
        throw new Error();
      });

    const requestOverride = {
      ...request,
      body: {
        caseId: '001-67-89123',
        attorneyList: ['John Doe'],
        role: 'TrialAttorney',
      },
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, requestOverride);

    expect(httpErrorSpy).toHaveBeenCalled();
    expect(context.res.statusCode).toEqual(500);
    expect(context.res.body.message).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('Should call createAssignmentRequest with the request parameters, when passed to httpTrigger in the body', async () => {
    const caseId = '001-67-89012';
    const requestOverride = {
      ...request,
      body: { caseId: caseId, attorneyList: ['Jane Doe'], role: 'TrialAttorney' },
    };

    const assignmentController: CaseAssignmentController = new CaseAssignmentController(context);
    const createAssignmentRequestSpy = jest.spyOn(
      Object.getPrototypeOf(assignmentController),
      'createTrialAttorneyAssignments',
    );
    await httpTrigger(context, requestOverride);

    expect(createAssignmentRequestSpy).toHaveBeenCalledWith(expect.objectContaining({ caseId }));
  });

  test('Should return a list of assignments when valid caseId is supplied for GET request', async () => {
    const caseId = '001-67-89012';
    const requestOverride = {
      ...request,
      method: 'GET',
      params: {
        id: caseId,
      },
      body: undefined,
    };

    const assignments: CaseAssignment[] = MockData.buildArray(MockData.getAttorneyAssignment, 3);

    const assignmentController: CaseAssignmentController = new CaseAssignmentController(context);

    const getAssignmentRequestSpy = jest
      .spyOn(Object.getPrototypeOf(assignmentController), 'getTrialAttorneyAssignments')
      .mockReturnValue(assignments);
    await httpTrigger(context, requestOverride);

    expect(getAssignmentRequestSpy).toHaveBeenCalledWith(caseId);
    expect(getAssignmentRequestSpy).toHaveReturnedWith(assignments);
  });
});
