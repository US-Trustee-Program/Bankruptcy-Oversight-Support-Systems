import httpTrigger from './orders.function';
import { CamsError } from '../lib/common-errors/cams-error';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { TransferOrderAction } from '../../../common/src/cams/orders';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest } from '../azure/functions';

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
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should return updated order', async () => {
    const id = '1234567890';

    updateOrder = jest
      .fn()
      .mockImplementation((_context: ApplicationContext, data: TransferOrderAction) => {
        return Promise.resolve({ success: true, body: data });
      });
    const requestOverride = {
      ...request,
      params: { id },
      body: {
        id,
        orderType: 'transfer',
      },
      method: 'PATCH',
    };

    const expectedResponseBody = {
      success: true,
      body: id,
    };
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toEqual(expectedResponseBody);
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
    await httpTrigger(context, request);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });

  test('should return error response when an unknown error is encountered on update', async () => {
    const id = '1234567890';
    getOrders = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    });
    const requestOverride = {
      ...request,
      params: { id },
      body: {
        id,
        orderType: 'transfer',
      },
      method: 'PATCH',
    };
    updateOrder = jest
      .fn()
      .mockImplementation((_context: ApplicationContext, _data: TransferOrderAction) => {
        throw new CamsError('ORDERS-FUNCTION-TEST', { message: 'Unknown error on update.' });
      });
    const expectedErrorResponse = {
      success: false,
      message: 'Unknown error on update.',
    };
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });

  test('should return error bad request error when id in parameters does not match id in data', async () => {
    const paramId = '1';
    const dataId = '2';
    const requestOverride = {
      ...request,
      params: { id: paramId },
      body: {
        id: dataId,
      },
      method: 'PATCH',
    };
    const expectedErrorResponse = {
      success: false,
      message: 'Cannot update order. ID of order does not match ID of request.',
    };
    await httpTrigger(context, requestOverride);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });
});
