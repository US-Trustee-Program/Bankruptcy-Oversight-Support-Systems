import { createMockAzureFunctionRequest } from '../azure/functions';
import ContextCreator from '../azure/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { ForbiddenError } from '../lib/common-errors/forbidden-error';
import handler from '../me/me.function';
import { InvocationContext } from '@azure/functions';

describe('me Function test', () => {
  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  const request = createMockAzureFunctionRequest();

  test('should set successful response', async () => {
    const camsSession = MockData.getCamsSession();
    jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(camsSession);

    const response = await handler(request, context);

    expect(response.jsonBody).toEqual(camsSession);
  });

  test('should handle an error response', async () => {
    const error = new ForbiddenError('FUNCTION_TEST');
    jest.spyOn(ContextCreator, 'getApplicationContextSession').mockRejectedValue(error);
    const expectedResponseBody = {
      success: false,
      message: error.message,
    };

    const response = await handler(request, context);

    expect(response.jsonBody).toEqual(expectedResponseBody);
  });
});
