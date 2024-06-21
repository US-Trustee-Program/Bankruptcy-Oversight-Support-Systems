import { INTERNAL_SERVER_ERROR } from '../lib/common-errors/constants';
import httpTrigger from './cases.function';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { CamsError } from '../lib/common-errors/cams-error';
import clearAllMocks = jest.clearAllMocks;
import { ApplicationContext } from '../lib/adapters/types/basic';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';

jest.mock('../lib/controllers/cases/cases.controller', () => {
  return {
    CasesController: jest.fn().mockImplementation(() => {
      return {
        getCases: () => {
          throw new Error('Test error');
        },
        getCaseDetails: () => {
          throw new CamsError('Case Details Error');
        },
      };
    }),
  };
});

describe('Mocking CasesController to get error handling', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    clearAllMocks();
  });

  test('error should be properly handled if httpTrigger throws an error', async () => {
    const request = {
      params: {},
      query: {},
      method: 'GET',
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(INTERNAL_SERVER_ERROR);
    expect(context.res.body.message).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });

  // TODO rethink how to trigger a CAMS error for this test
  test('should call httpError if a CamsError is caught getting a case', async () => {
    const request = {
      params: { caseId: '00000' },
      method: 'GET',
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(INTERNAL_SERVER_ERROR);
    expect(context.res.body.message).toEqual('Unknown CAMS Error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(CamsError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('should call httpError if a CamsError is caught getting all cases', async () => {
    const request = {
      params: {},
      method: 'GET',
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(INTERNAL_SERVER_ERROR);
    expect(context.res.body.message).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });
});
