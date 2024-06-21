import httpTrigger from './orders.function';
import { CamsError } from '../lib/common-errors/cams-error';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { TransferOrderAction } from '../../../common/src/cams/orders';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../lib/testing/testing-utilities';

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
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
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
    await httpTrigger(context, context.req);
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
      params: { id },
      body: {
        id,
        orderType: 'transfer',
      },
    };
    context.req = {
      ...context.req,
      ...requestOverride,
      method: 'PATCH',
    };
    const expectedResponseBody = {
      success: true,
      body: id,
    };
    await httpTrigger(context, context.req);
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
    await httpTrigger(context, context.req);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });

  test('should return error response when an unknown error is encountered on update', async () => {
    const id = '1234567890';
    getOrders = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
    });
    const requestOverride = {
      params: { id },
      body: {
        id,
        orderType: 'transfer',
      },
    };
    context.req = {
      ...context.req,
      ...requestOverride,
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
    await httpTrigger(context, context.req);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });

  test('should return error bad request error when id in parameters does not match id in data', async () => {
    const paramId = '1';
    const dataId = '2';
    const requestOverride = {
      params: { id: paramId },
      body: {
        id: dataId,
      },
    };
    context.req = {
      ...context.req,
      ...requestOverride,
      method: 'PATCH',
    };
    const expectedErrorResponse = {
      success: false,
      message: 'Cannot update order. ID of order does not match ID of request.',
    };
    await httpTrigger(context, context.req);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });
});
