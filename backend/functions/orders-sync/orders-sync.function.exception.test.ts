import { CamsError } from '../lib/common-errors/cams-error';

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
