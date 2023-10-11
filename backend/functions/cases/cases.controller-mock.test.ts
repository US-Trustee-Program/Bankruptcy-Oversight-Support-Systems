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
        getCaseList: (query: { caseChapter?: string }) => {
          if (query.caseChapter === '') {
            throw new Error('Test error');
          }
          if (query.caseChapter === 'error') {
            throw new CamsError('fake-module');
          }
        },
      };
    }),
  };
});

describe('Mocking CasesController to get error handling', () => {
  //const MockedCasesController = jest.mocked(CasesController);

  beforeEach(() => {
    clearAllMocks();
  });

  test('error should be properly handled if casesController.getCaseList() throws an error', async () => {
    const request = {
      query: {},
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(INTERNAL_SERVER_ERROR);
    expect(context.res.body.error).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('should call httpError if a CamsError is caught', async () => {
    const request = {
      query: { chapter: 'error' },
    };

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    await httpTrigger(context, request);

    expect(context.res.statusCode).toEqual(INTERNAL_SERVER_ERROR);
    expect(context.res.body.error).toEqual('Unknown CAMS Error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(CamsError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });
});
