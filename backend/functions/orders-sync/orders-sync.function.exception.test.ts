import { CamsError } from '../lib/common-errors/cams-error';

const context = require('azure-function-context-mock');

jest.mock('../lib/controllers/orders/orders.controller', () => {
  return {
    OrdersController: jest.fn().mockImplementation(() => {
      return {
        syncOrders: () => {
          throw new CamsError('MOCK_ORDERS_CONTROLLER', { message: 'Mocked error' });
        },
      };
    }),
  };
});

describe('Orders Functions exception tests', () => {
  test.skip('should return an error response when an error is encountered', async () => {
    const expectedErrorResponse = {
      success: false,
      message: 'Mocked error',
    };
    expect(context.res.body).toMatchObject(expectedErrorResponse);
  });
});
