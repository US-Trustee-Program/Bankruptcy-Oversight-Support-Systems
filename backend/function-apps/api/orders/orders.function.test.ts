import { vi } from 'vitest';
import handler from './orders.function';
import { CamsError } from '../../../lib/common-errors/cams-error';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { Order } from '../../../../common/src/cams/orders';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { commonHeaders } from '../../../lib/adapters/utils/http-response';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';

describe('Orders Function tests', () => {
  const request = createMockAzureFunctionRequest({
    url: 'http://domain/api/orders',
  });
  const context = createMockAzureFunctionContext();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('should return a list of orders', async () => {
    const mockOrders = [MockData.getTransferOrder(), MockData.getConsolidationOrder()];
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<Order[]>({
      data: mockOrders,
    });

    vi.spyOn(OrdersController.prototype, 'getOrders').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return proper response when successfully updating an order', async () => {
    const id = '1234567890';

    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess(undefined, {
      headers: commonHeaders,
      statusCode: HttpStatusCodes.NO_CONTENT,
    });

    const updateOrder = vi
      .spyOn(OrdersController.prototype, 'updateOrder')
      .mockResolvedValue(camsHttpResponse);

    const orderRequest = createMockAzureFunctionRequest({
      url: 'http://domain/api/orders',
      params: { id },
      body: {
        id,
        orderType: 'transfer',
      },
      method: 'PATCH',
    });

    const response = await handler(orderRequest, context);

    expect(updateOrder).toHaveBeenCalled();
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return error response when error is encountered on get list', async () => {
    const error = new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);

    vi.spyOn(OrdersController.prototype, 'getOrders').mockRejectedValue(error);

    const response = await handler(request, context);
    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });

  test('should return error response when an unknown error is encountered on update', async () => {
    const error = new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);

    vi.spyOn(OrdersController.prototype, 'updateOrder').mockRejectedValue(error);

    const id = '1234567890';
    const requestOverride: Partial<CamsHttpRequest> = {
      url: 'http://domain/api/orders',
      params: { id },
      body: {
        id,
        orderType: 'transfer',
      },
      method: 'PATCH',
    };
    const orderRequest = createMockAzureFunctionRequest(requestOverride);
    const response = await handler(orderRequest, context);
    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });
});
