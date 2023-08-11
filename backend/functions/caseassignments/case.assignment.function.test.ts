import httpTrigger from './case.assignment.function';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import * as httpModule from '../lib/adapters/utils/http';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
describe('Case Assignment Function Tests', () => {
  test('Return the function response with the assignment Id created for the new case assignment', async () => {
    const request = {
      query: {},
      body: {
        caseId: '6789',
        attorneyIdList: ['9082'],
        role: 'TrialAttorney',
      },
    };

    const expectedResponse = {
      assignmentIdList: [1],
      success: true,
      message: 'Trial attorney assignments created.',
      resultCount: 1,
    };
    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
  });

  test('returns response with multiple assignment Ids , when requested to create assignments for multiple trial attorneys on a case', async () => {
    const request = {
      query: {},
      body: {
        caseId: '6789',
        attorneyIdList: ['2082', '2083', '2082'],
        role: 'TrialAttorney',
      },
    };

    const expectedResponse = {
      assignmentIdList: [1, 2],
      success: true,
      message: 'Trial attorney assignments created.',
      resultCount: 2,
    };

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
  });
  test('handle any duplicate attorney Ids passed in the request, not create duplicate assignments', async () => {
    const request = {
      query: {},
      body: {
        caseId: '6789',
        attorneyIdList: ['2082', '2082'],
        role: 'TrialAttorney',
      },
    };

    const expectedResponse = {
      assignmentIdList: [1],
      success: true,
      message: 'Trial attorney assignments created.',
      resultCount: 1,
    };

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
  });

  test('returns bad request 400 when a caseId is not passed in the request', async () => {
    const request = {
      query: {},
      body: {
        caseId: '',
        attorneyIdList: ['2082', '2083'],
        role: 'TrialAttorney',
      },
    };
    const expectedResponse = {
      error: 'Required parameter caseId is absent.',
    };

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
    expect(appContext.res.statusCode).toBe(400);
    expect(appContext.res.body);
  });

  test('returns bad request 400 when a AttorneyIdList is empty or not passed in the request', async () => {
    const request = {
      query: {},
      body: {
        caseId: '909',
        attorneyIdList: [],
        role: 'TrialAttorney',
      },
    };
    const expectedResponse = {
      error: 'Required parameter attorneyId is absent.',
    };

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
    expect(appContext.res.statusCode).toBe(400);
    expect(appContext.res.body);
  });

  test('returns bad request 400 when a role is not passed in the request', async () => {
    const request = {
      query: {},
      body: {
        caseId: '909',
        attorneyIdList: ['1000'],
        role: '',
      },
    };
    const expectedResponse = {
      error: 'Required parameter - role of the attorney is absent.',
    };

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
    expect(appContext.res.statusCode).toBe(400);
    expect(appContext.res.body);
  });

  test('returns bad request 400 when a role of TrialAttorney is not passed in the request', async () => {
    const request = {
      query: {},
      body: {
        caseId: '909',
        attorneyIdList: ['1000'],
        role: 'TrialDragon',
      },
    };
    const expectedResponse = {
      error:
        'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment',
    };

    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
    expect(appContext.res.statusCode).toBe(400);
    expect(appContext.res.body);
  });

  test('Should return an HTTP Error if the controller throws an error during assignment creation', async () => {
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(context);
    jest
      .spyOn(Object.getPrototypeOf(assignmentController), 'createTrailAttorneyAssignments')
      .mockImplementation(() => {
        throw new Error('Mock Error');
      });

    const request = {
      query: {},
      body: {
        caseId: '6789',
        attorneyIdList: ['2082'],
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
    const _caseId = '6789';
    const request = {
      query: {},
      body: { caseId: _caseId, attorneyIdList: ['2082'], role: 'TrialAttorney' },
    };
    const assignmentController: CaseAssignmentController = new CaseAssignmentController(context);
    const createAssignmentRequestSpy = jest.spyOn(
      Object.getPrototypeOf(assignmentController),
      'createTrailAttorneyAssignments',
    );
    await httpTrigger(context, request);

    expect(createAssignmentRequestSpy).toHaveBeenCalledWith(expect.objectContaining({ _caseId }));
  });
});
