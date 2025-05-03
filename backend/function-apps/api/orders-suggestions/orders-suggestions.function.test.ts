import { CaseSummary } from '../../../../common/src/cams/cases';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import {
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { buildTestResponseError } from '../../azure/testing-helpers';
import handler from './orders-suggestions.function';

describe('Orders suggestions function tests', () => {
  const context = createMockAzureFunctionContext();
  const request = createMockAzureFunctionRequest({
    method: 'GET',
    url: 'http://domain/api/orders-suggestions',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return a list of suggested cases', async () => {
    const summaries = [MockData.getCaseSummary(), MockData.getCaseSummary()];
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<CaseSummary[]>({
      data: summaries,
    });

    const getSuggestedCasesSpy = jest
      .spyOn(OrdersController.prototype, 'getSuggestedCases')
      .mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(getSuggestedCasesSpy).toHaveBeenCalled();
    expect(response).toMatchObject(azureHttpResponse);
  });

  test('should return error response when error is encountered', async () => {
    const error = new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked Error' });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);
    jest.spyOn(OrdersController.prototype, 'getSuggestedCases').mockRejectedValue(error);

    const response = await handler(request, context);
    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
