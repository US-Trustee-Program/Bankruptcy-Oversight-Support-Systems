import httpTrigger from '../me/me.function';
import { createMockAzureFunctionRequest } from '../azure/functions';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { ForbiddenError } from '../lib/common-errors/forbidden-error';

describe('me Function test', () => {
  const request = createMockAzureFunctionRequest();
  const context = require('azure-function-context-mock');

  test('should set successful response', async () => {
    const camsSession = MockData.getCamsSession();
    jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(camsSession);

    const expectedResponseBody = {
      success: true,
      body: camsSession,
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should handle an error response', async () => {
    const error = new ForbiddenError('FUNCTION_TEST');
    jest.spyOn(ContextCreator, 'getApplicationContextSession').mockRejectedValue(error);
    const expectedResponseBody = {
      success: false,
      message: error.message,
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(expectedResponseBody);
  });
});
