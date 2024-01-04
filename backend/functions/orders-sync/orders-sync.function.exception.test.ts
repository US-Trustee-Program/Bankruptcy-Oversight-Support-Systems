import { CamsError } from '../lib/common-errors/cams-error';

// const context = require('azure-function-context-mock');

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

describe('Orders Sync Function exception tests', () => {
  test('tbd', async () => {});
});
