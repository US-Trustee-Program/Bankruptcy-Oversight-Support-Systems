import httpTrigger from './case.assignment.function';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import * as httpModule from '../lib/adapters/utils/http-client';

const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
describe('Case Assignment Function Tests', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      DATABASE_MOCK: 'true',
    };
  });

  test('Return the function response with the assignment Id created for the new case assignment', async () => {
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
    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expect.objectContaining(expectedResponse));
    expect(appContext.res.body.body.length).toEqual(1);
  });

  test('returns response with multiple assignment Ids , when requested to create assignments for multiple trial attorneys on a case', async () => {
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

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expect.objectContaining(expectedResponse));
    expect(appContext.res.body.body.length).toEqual(2);
  });

  test('handle any duplicate attorneys passed in the request, not create duplicate assignments', async () => {
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

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expect.objectContaining(expectedResponse));
    expect(appContext.res.body.body.length).toEqual(1);
  });

  test('returns bad request 400 when a caseId is not passed in the request', async () => {
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

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
    expect(appContext.res.statusCode).toEqual(400);
  });

  test('returns bad request 400 when a caseId is invalid format', async () => {
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

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
    expect(appContext.res.statusCode).toEqual(400);
  });

  test('returns bad request 400 when a attorneyList is empty or not passed in the request', async () => {
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

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
    expect(appContext.res.statusCode).toEqual(400);
  });

  test('returns bad request 400 when a role is not passed in the request', async () => {
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

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
    expect(appContext.res.statusCode).toEqual(400);
  });

  test('returns bad request 400 when a role of TrialAttorney is not passed in the request', async () => {
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

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
    expect(appContext.res.statusCode).toEqual(400);
  });

  test('Should return an HTTP Error if the controller throws an error during assignment creation', async () => {
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(context);
    jest
      .spyOn(Object.getPrototypeOf(assignmentController), 'createTrialAttorneyAssignments')
      .mockImplementation(() => {
        throw new Error('Mock Error');
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

    const httpErrorSpy = jest.spyOn(httpModule, 'httpError');
    await httpTrigger(context, request);

    expect(httpErrorSpy).toHaveBeenCalled();
    expect(context.res.statusCode).toEqual(500);
    expect(context.res.body.error).toEqual('Mock Error');
  });

  test('Should call createAssignmentRequest with the request parameters, when passed to httpTrigger in the body', async () => {
    const caseId = '001-67-89012';
    const request = {
      method: 'POST',
      query: {},
      body: { caseId: caseId, attorneyList: ['Jane Doe'], role: 'TrialAttorney' },
    };
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(context);
    const createAssignmentRequestSpy = jest.spyOn(
      Object.getPrototypeOf(assignmentController),
      'createTrialAttorneyAssignments',
    );
    await httpTrigger(context, request);

    expect(createAssignmentRequestSpy).toHaveBeenCalledWith(expect.objectContaining({ caseId }));
  });
});
