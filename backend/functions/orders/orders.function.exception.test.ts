import httpTrigger from './orders.function';
import { CamsError } from '../lib/common-errors/cams-error';

const context = require('azure-function-context-mock');

jest.mock('../lib/controllers/orders/orders.controller', () => {
  return {
    OrdersController: jest.fn().mockImplementation(() => {
      return {
        getOrders: () => {
          throw new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
        },
      };
    }),
  };
});

describe('Orders Functions exception tests', () => {
  test('should return an error response when an error is encountered', async () => {
    const request = {
      params: {},
    };
    const expectedErrorResponse = {
      success: false,
      message: 'Mocked error',
    };
    await httpTrigger(context, request);
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });
});
