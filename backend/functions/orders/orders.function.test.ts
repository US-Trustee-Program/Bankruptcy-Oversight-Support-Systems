import httpTrigger from './orders.function';
import { ORDERS } from '../lib/testing/mock-data/orders.mock';
import { CamsError } from '../lib/common-errors/cams-error';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { OrderTransfer } from '../lib/use-cases/orders/orders.model';

const context = require('azure-function-context-mock');

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
  test('should return a list of orders', async () => {
    getOrders = jest.fn().mockImplementation(() => {
      return Promise.resolve({ success: true, body: ORDERS });
    });
    const request = {
      params: {},
      method: 'GET',
    };
    const expectedResponseBody = {
      success: true,
      body: ORDERS,
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('should return updated order', async () => {
    const id = '1234567890';

    updateOrder = jest
      .fn()
      .mockImplementation((context: ApplicationContext, data: OrderTransfer) => {
        return Promise.resolve({ success: true, body: data });
      });
    const request = {
      params: {},
      method: 'PATCH',
      body: {
        id,
      },
    };
    const expectedResponseBody = {
      success: true,
      body: {
        id,
      },
    };
    process.env = {
      DATABASE_MOCK: 'true',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
    expect(updateOrder).toHaveBeenCalled();
  });

  test('should return error response', async () => {
    getOrders = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    });
    const request = {
      params: {},
      method: 'GET',
    };
    const expectedErrorResponse = {
      success: false,
      message: 'Mocked error',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });
});
