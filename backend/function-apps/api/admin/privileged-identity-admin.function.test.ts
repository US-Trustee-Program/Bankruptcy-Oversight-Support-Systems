import { InvocationContext } from '@azure/functions';
import { PrivilegedIdentityAdminController } from '../../../lib/controllers/admin/privileged-identity-admin.controller';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './privileged-identity-admin.function';

describe('Privileged identity admin Function tests', () => {
  const context = new InvocationContext();

  test('should return success response', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'GET',
    });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess({ data: {} });
    vi.spyOn(PrivilegedIdentityAdminController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return failure response', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'GET',
    });
    const error = new Error('some error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(PrivilegedIdentityAdminController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
