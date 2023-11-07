import httpTrigger from './case.assignment.function';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AssignmentError } from '../lib/use-cases/assignment.exception';
import { UnknownError } from '../lib/common-errors/unknown-error';

const functionContext = require('azure-function-context-mock');

describe('Case Assignment Function Tests', () => {
  const env = process.env;
  beforeEach(() => {
    process.env = {
      ...env,
      DATABASE_MOCK: 'true',
    };
  });

  test('Return the function response with the assignment Id created for the new case assignment', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const request = {
      method: 'POST',
      query: {},
      body: {
        caseId: '001-67-89123',
        attorneyList: ['Bob Bob'],
        role: 'TrialAttorney',
      },
    };

    const expectedResponse = {
      success: true,
      message: 'Trial attorney assignments created.',
      count: 1,
    };
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expect.objectContaining(expectedResponse));
    expect(applicationContext.res.body.body.length).toEqual(1);
  });

  test('returns response with multiple assignment Ids , when requested to create assignments for multiple trial attorneys on a case', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const request = {
      method: 'POST',
      query: {},
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

    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expect.objectContaining(expectedResponse));
    expect(applicationContext.res.body.body.length).toEqual(2);
  });

  test('handle any duplicate attorneys passed in the request, not create duplicate assignments', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const request = {
      method: 'POST',
      query: {},
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

    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expect.objectContaining(expectedResponse));
    expect(applicationContext.res.body.body.length).toEqual(1);
  });

  test('returns bad request 400 when a caseId is not passed in the request', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const request = {
      method: 'POST',
      query: {},
      body: {
        caseId: '',
        attorneyList: ['Bob', 'Denise'],
        role: 'TrialAttorney',
      },
    };

    const expectedResponse = { error: 'Required parameter(s) caseId is/are absent.' };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expectedResponse);
    expect(applicationContext.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a caseId is invalid format', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const request = {
      method: 'POST',
      query: {},
      body: {
        caseId: '123',
        attorneyList: ['Bob', 'Denise'],
        role: 'TrialAttorney',
      },
    };
    const expectedResponse = { error: 'caseId must be formatted like 01-12345.' };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expectedResponse);
    expect(applicationContext.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a attorneyList is empty or not passed in the request', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const request = {
      method: 'POST',
      query: {},
      body: {
        caseId: '001-90-90123',
        attorneyList: [],
        role: 'TrialAttorney',
      },
    };
    const expectedResponse = { error: 'Required parameter(s) attorneyList is/are absent.' };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expectedResponse);
    expect(applicationContext.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a role is not passed in the request', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const request = {
      method: 'POST',
      query: {},
      body: {
        caseId: '001-90-90123',
        attorneyList: ['John Doe'],
        role: '',
      },
    };
    const expectedResponse = {
      error:
        'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment. Required parameter(s) role is/are absent.',
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expectedResponse);
    expect(applicationContext.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a role of TrialAttorney is not passed in the request', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const request = {
      method: 'POST',
      query: {},
      body: {
        caseId: '001-90-90123',
        attorneyList: ['John Doe'],
        role: 'TrialDragon',
      },
    };
    const expectedResponse = {
      error:
        'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment.',
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expectedResponse);
    expect(applicationContext.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('Should return an HTTP Error if the controller throws an error during assignment creation', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(
      applicationContext,
    );
    jest
      .spyOn(Object.getPrototypeOf(assignmentController), 'createTrialAttorneyAssignments')
      .mockImplementation(() => {
        throw new Error();
      });

    const request = {
      method: 'POST',
      query: {},
      body: {
        caseId: '001-67-89123',
        attorneyList: ['John Doe'],
        role: 'TrialAttorney',
      },
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(applicationContext, request);

    expect(httpErrorSpy).toHaveBeenCalled();
    expect(applicationContext.res.statusCode).toEqual(500);
    expect(applicationContext.res.body.error).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('Should call createAssignmentRequest with the request parameters, when passed to httpTrigger in the body', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const caseId = '001-67-89012';
    const request = {
      method: 'POST',
      query: {},
      body: { caseId: caseId, attorneyList: ['Jane Doe'], role: 'TrialAttorney' },
    };
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(
      applicationContext,
    );
    const createAssignmentRequestSpy = jest.spyOn(
      Object.getPrototypeOf(assignmentController),
      'createTrialAttorneyAssignments',
    );
    await httpTrigger(applicationContext, request);

    expect(createAssignmentRequestSpy).toHaveBeenCalledWith(expect.objectContaining({ caseId }));
  });
});
