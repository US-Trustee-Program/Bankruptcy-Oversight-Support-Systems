import { InvocationContext } from '@azure/functions';
import { CaseReloadController } from '../../../lib/controllers/admin/case-reload.controller';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './case-reload.function';

describe('Case Reload Function tests', () => {
  const context = new InvocationContext();

  test('should return success response', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'POST',
    });
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess();
    vi.spyOn(CaseReloadController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return failure response', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'POST',
    });
    const error = new Error('some error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(CaseReloadController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
