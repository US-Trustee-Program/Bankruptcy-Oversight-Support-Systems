import { InvocationContext } from '@azure/functions';
import { TrusteeDataReportController } from '../../../lib/controllers/admin/trustee-data-report.controller';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './trustee-data-report.function';
import { CamsHttpMethod } from '../../../lib/adapters/types/http';

describe('Trustee Data Report Function tests', () => {
  const context = new InvocationContext();

  test.each<CamsHttpMethod>(['GET', 'POST'])(
    'should return a success response for %s',
    async (method) => {
      const request = createMockAzureFunctionRequest({ method });
      const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess();
      vi.spyOn(TrusteeDataReportController.prototype, 'handleRequest').mockResolvedValue(
        camsHttpResponse,
      );
      const response = await handler(request, context);
      expect(response).toEqual(azureHttpResponse);
    },
  );

  test('should return a failure response', async () => {
    const request = createMockAzureFunctionRequest({ method: 'POST' });
    const error = new Error('some error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(TrusteeDataReportController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
