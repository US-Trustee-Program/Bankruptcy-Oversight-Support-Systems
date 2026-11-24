import { InvocationContext } from '@azure/functions';
import { UserAccessController } from '../../../lib/controllers/user-access/user-access.controller';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './user-access.function';

describe('User access Function tests', () => {
  const context = new InvocationContext();

  test('should return success response', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'GET',
    });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess({ data: [] });
    vi.spyOn(UserAccessController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return failure response', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'GET',
    });
    const error = new Error('some error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(UserAccessController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
