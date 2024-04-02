import httpTrigger from './case.assignment.function';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { AssignmentError } from '../lib/use-cases/assignment.exception';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';
import { CaseAssignment } from '../../../common/src/cams/assignments';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';

describe('Case Assignment Function Tests', () => {
  test('Return the function response with the assignment Id created for the new case assignment', async () => {
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
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
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
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
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
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
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const request = {
      method: 'POST',
      query: {},
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
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expectedResponse);
    expect(applicationContext.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a caseId is invalid format', async () => {
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const request = {
      method: 'POST',
      query: {},
      body: {
        caseId: '123',
        attorneyList: ['Bob', 'Denise'],
        role: 'TrialAttorney',
      },
    };
    const expectedResponse = { message: 'caseId must be formatted like 01-12345.', success: false };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expectedResponse);
    expect(applicationContext.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a role is not passed in the request', async () => {
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
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
      message:
        'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment. Required parameter(s) role is/are absent.',
      success: false,
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expectedResponse);
    expect(applicationContext.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('returns bad request 400 when a role of TrialAttorney is not passed in the request', async () => {
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
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
      message:
        'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment.',
      success: false,
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(applicationContext, request);
    expect(applicationContext.res.body).toEqual(expectedResponse);
    expect(applicationContext.res.statusCode).toEqual(400);
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(AssignmentError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('Should return an HTTP Error if the controller throws an error during assignment creation', async () => {
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
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
    expect(applicationContext.res.body.message).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('Should call createAssignmentRequest with the request parameters, when passed to httpTrigger in the body', async () => {
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
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

  test('Should return a list a assignments when valid caseId is supplied for GET request', async () => {
    const applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const caseId = '001-67-89012';
    const request = {
      method: 'GET',
      params: {
        id: caseId,
      },
    };
    const assignments: CaseAssignment[] = MockData.buildArray(MockData.getAttorneyAssignment, 3);

    const assignmentController: CaseAssignmentController = new CaseAssignmentController(
      applicationContext,
    );

    const getAssignmentRequestSpy = jest
      .spyOn(Object.getPrototypeOf(assignmentController), 'getTrialAttorneyAssignments')
      .mockReturnValue(assignments);
    await httpTrigger(applicationContext, request);

    expect(getAssignmentRequestSpy).toHaveBeenCalledWith(caseId);
    expect(getAssignmentRequestSpy).toHaveReturnedWith(assignments);
  });
});
