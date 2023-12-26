import { OrdersController } from './orders.controller';
import { CaseHistoryUseCase } from '../../use-cases/case-history/case-history';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CamsError } from '../../common-errors/cams-error';

let getOrders;

jest.mock('../../use-cases/orders/orders', () => {
  return {
    OrdersUseCase: jest.fn().mockImplementation(() => {
      return {
        getOrders,
      };
    }),
  };
});

describe('orders controller exception tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('should wrap unexpected errors with CamsError', async () => {
    getOrders = jest.fn().mockImplementation(() => {
      return Promise.reject('unknown error');
    });
    const expectedMessage = 'Unknown error';
    const controller = new OrdersController(applicationContext);
    jest.spyOn(CaseHistoryUseCase.prototype, 'getCaseHistory').mockImplementation(async () => {
      throw Error(expectedMessage);
    });
    await expect(controller.getOrders(applicationContext)).rejects.toThrow(expectedMessage);
  });

  test('should throw CamsError when caught', async () => {
    const expectedMessage = 'Some expected CAMS error.';
    getOrders = jest.fn().mockImplementation(() => {
      throw new CamsError('MOCK_ORDERS_CONTROLLER', { message: expectedMessage });
    });
    const controller = new OrdersController(applicationContext);
    jest.spyOn(CaseHistoryUseCase.prototype, 'getCaseHistory').mockImplementation(async () => {
      throw Error(expectedMessage);
    });
    await expect(controller.getOrders(applicationContext)).rejects.toThrow(expectedMessage);
  });
});
