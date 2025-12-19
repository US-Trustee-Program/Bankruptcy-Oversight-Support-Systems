import { vi } from 'vitest';
import handler from './orders-suggestions.function';
import { CamsError } from '../../../lib/common-errors/cams-error';
import {
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CaseSummary } from '../../../../common/src/cams/cases';
import { buildTestResponseError } from '../../azure/testing-helpers';

describe('Orders suggestions function tests', () => {
  const context = createMockAzureFunctionContext();
  const request = createMockAzureFunctionRequest({
    url: 'http://domain/api/orders-suggestions',
    method: 'GET',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should return a list of suggested cases', async () => {
    const summaries = [MockData.getCaseSummary(), MockData.getCaseSummary()];
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<CaseSummary[]>({
      data: summaries,
    });

    const getSuggestedCasesSpy = vi
      .spyOn(OrdersController.prototype, 'getSuggestedCases')
      .mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(getSuggestedCasesSpy).toHaveBeenCalled();
    expect(response).toMatchObject(azureHttpResponse);
  });

  test('should return error response when error is encountered', async () => {
    const error = new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked Error' });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    vi.spyOn(OrdersController.prototype, 'getSuggestedCases').mockRejectedValue(error);

    const response = await handler(request, context);
    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
