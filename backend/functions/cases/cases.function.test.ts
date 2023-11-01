import { INTERNAL_SERVER_ERROR } from '../lib/common-errors/constants';
import httpTrigger from './cases.function';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { CamsError } from '../lib/common-errors/cams-error';
import clearAllMocks = jest.clearAllMocks;
const context = require('azure-function-context-mock');

jest.mock('../lib/adapters/controllers/cases.controller', () => {
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
  beforeEach(() => {
    clearAllMocks();
  });

  test('error should be properly handled if casesController.getCases() throws an error', async () => {
    const request = {
      query: {},
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(INTERNAL_SERVER_ERROR);
    expect(context.res.body.error).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });

  //TODO rethink how to trigger a CAMS error for this test
  test('should call httpError if a CamsError is caught', async () => {
    const request = {
      params: { caseId: '00000' },
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(INTERNAL_SERVER_ERROR);
    expect(context.res.body.error).toEqual('Unknown CAMS Error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(CamsError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });
});
