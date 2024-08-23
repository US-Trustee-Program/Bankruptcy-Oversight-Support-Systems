import { handler } from './orders.function';
import { CamsError } from '../lib/common-errors/cams-error';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { TransferOrderAction } from '../../../common/src/cams/orders';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest } from '../azure/functions';
import { CamsHttpRequest } from '../lib/adapters/types/http';

let getOrders;
let updateOrder;

jest.mock('../lib/controllers/orders/orders.controller', () => {
  return {
    OrdersController: jest.fn().mockImplementation(() => {
      return {
        getOrders,
        updateOrder,
      };
    }),
  };
});

describe('Orders Function tests', () => {
  const request = createMockAzureFunctionRequest();
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const context = require('azure-function-context-mock');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return a list of orders', async () => {
    const mockOrders = [MockData.getTransferOrder(), MockData.getConsolidationOrder()];
    getOrders = jest.fn().mockImplementation(() => {
      return Promise.resolve({ success: true, body: mockOrders });
    });
    const expectedResponseBody = {
      success: true,
      body: mockOrders,
    };
    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(expectedResponseBody);
  });

  test('should return updated order', async () => {
    const id = '1234567890';

    updateOrder = jest
      .fn()
      .mockImplementation((_context: ApplicationContext, data: TransferOrderAction) => {
        return Promise.resolve({ success: true, body: data });
      });

    const orderRequest = createMockAzureFunctionRequest({
      params: { id },
      body: {
        id,
        orderType: 'transfer',
      },
      method: 'PATCH',
    });

    const expectedResponseBody = {
      success: true,
      body: id,
    };

    const response = await handler(orderRequest, context);
    console.log('Request Id: ');
    expect(response.jsonBody).toEqual(expectedResponseBody);
    expect(updateOrder).toHaveBeenCalled();
  });

  test('should return error response when error is encountered on get list', async () => {
    getOrders = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    });
    const expectedErrorResponse = {
      success: false,
      message: 'Mocked error',
    };
    const response = await handler(request, context);
    expect(response.jsonBody).toMatchObject(expectedErrorResponse);
  });

  test('should return error response when an unknown error is encountered on update', async () => {
    const id = '1234567890';
    getOrders = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    });
    const requestOverride: Partial<CamsHttpRequest> = {
      params: { id },
      body: {
        id,
        orderType: 'transfer',
      },
      method: 'PATCH',
    };
    const orderRequest = createMockAzureFunctionRequest({ ...requestOverride });
    updateOrder = jest
      .fn()
      .mockImplementation((_context: ApplicationContext, _data: TransferOrderAction) => {
        throw new CamsError('ORDERS-FUNCTION-TEST', { message: 'Unknown error on update.' });
      });
    const expectedErrorResponse = {
      success: false,
      message: 'Unknown error on update.',
    };
    const response = await handler(orderRequest, context);
    expect(response.jsonBody).toMatchObject(expectedErrorResponse);
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
    expect(response.jsonBody).toMatchObject(expectedErrorResponse);
  });
});
