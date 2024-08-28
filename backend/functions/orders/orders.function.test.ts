import handler from './orders.function';
import { CamsError } from '../lib/common-errors/cams-error';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../lib/adapters/types/http';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { Order } from '../../../common/src/cams/orders';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../azure/testing-helpers';

describe('Orders Function tests', () => {
  const request = createMockAzureFunctionRequest({});

  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const context = createMockAzureFunctionContext();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return a list of orders', async () => {
    const mockOrders = [MockData.getTransferOrder(), MockData.getConsolidationOrder()];
    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess<Order[]>(mockOrders);

    jest.spyOn(OrdersController.prototype, 'getOrders').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return updated order', async () => {
    const id = '1234567890';

    const { camsHttpResponse, azureHttpResponse } = buildTestResponseSuccess();

    const updateOrder = jest
      .spyOn(OrdersController.prototype, 'updateOrder')
      .mockResolvedValue(camsHttpResponse);

    const orderRequest = createMockAzureFunctionRequest({
      params: { id },
      body: {
        id,
        orderType: 'transfer',
      },
      method: 'PATCH',
    });

    const response = await handler(orderRequest, context);

    expect(response).toEqual(azureHttpResponse);
    expect(updateOrder).toHaveBeenCalled();
  });

  test('should return error response when error is encountered on get list', async () => {
    const error = new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);

    jest.spyOn(OrdersController.prototype, 'getOrders').mockRejectedValue(error);

    const response = await handler(request, context);
    expect(response).toMatchObject(azureHttpResponse);
    expect(loggerCamsErrorSpy).toHaveBeenCalledWith(error);
  });

  test('should return error response when an unknown error is encountered on update', async () => {
    const error = new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    const { azureHttpResponse, loggerCamsErrorSpy } = buildTestResponseError(error);

    jest.spyOn(OrdersController.prototype, 'updateOrder').mockRejectedValue(error);

    const id = '1234567890';
    const requestOverride: Partial<CamsHttpRequest> = {
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

  test('should return error bad request error when id in parameters does not match id in data', async () => {
    const paramId = '1';

    const dataId = '2';
    const requestOverride: Partial<CamsHttpRequest> = {
      params: { id: paramId },
      body: {
        id: dataId,
      },
      method: 'PATCH',
    };
    const orderRequest = createMockAzureFunctionRequest({ ...requestOverride });
    const expectedErrorResponse = {
      success: false,
      message: 'Cannot update order. ID of order does not match ID of request.',
    };
    const response = await handler(orderRequest, context);
    console.log(response.jsonBody);
    expect(response.jsonBody).toMatchObject(expectedErrorResponse);
  });
});
