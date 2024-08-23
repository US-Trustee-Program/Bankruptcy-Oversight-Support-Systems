import { INTERNAL_SERVER_ERROR } from '../lib/common-errors/constants';
import * as httpResponseModule from '../lib/adapters/utils/http-response';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { CamsError } from '../lib/common-errors/cams-error';
import { createMockAzureFunctionRequest, createMockAzureFunctionContext } from '../azure/functions';
import handler from './cases.function';

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
  const context = createMockAzureFunctionContext();

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  test('error should be properly handled if httpTrigger throws an error', async () => {
    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const request = createMockAzureFunctionRequest();
    const response = await handler(request, context);

    expect(response.status).toEqual(INTERNAL_SERVER_ERROR);
    expect(response.jsonBody.message).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });

  // TODO rethink how to trigger a CAMS error for this test
  test('should call httpError if a CamsError is caught getting a case', async () => {
    const request = createMockAzureFunctionRequest({
      params: { caseId: '00000' },
    });

    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const response = await handler(request, context);

    expect(response.status).toEqual(INTERNAL_SERVER_ERROR);
    expect(response.jsonBody.message).toEqual('Unknown CAMS Error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(CamsError));
    expect(httpErrorSpy).not.toHaveBeenCalledWith(expect.any(UnknownError));
  });

  test('should call httpError if a CamsError is caught getting all cases', async () => {
    const httpErrorSpy = jest.spyOn(httpResponseModule, 'httpError');
    const request = createMockAzureFunctionRequest();
    const response = await handler(request, context);

    expect(response.status).toEqual(INTERNAL_SERVER_ERROR);
    expect(response.jsonBody.message).toEqual('Unknown error');
    expect(httpErrorSpy).toHaveBeenCalledWith(expect.any(UnknownError));
  });
});
