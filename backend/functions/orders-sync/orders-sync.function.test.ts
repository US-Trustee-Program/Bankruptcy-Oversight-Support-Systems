import { LoggerImpl } from '../lib/adapters/utils/application-context-creator';
import { CamsError } from '../lib/common-errors/cams-error';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import timerTrigger from './orders-sync.function';
const context = require('azure-function-context-mock');

describe('Orders Sync Function tests', () => {
  test('Should call orders controller method syncOrders', async () => {
    const syncOrders = jest
      .spyOn(OrdersController.prototype, 'syncOrders')
      .mockImplementation(async () => {});
    await timerTrigger(context);
    expect(syncOrders).toHaveBeenCalled();
  });

  test('Should log a camsError if syncOrders throws a CamsError', async () => {
    const syncOrders = jest
      .spyOn(OrdersController.prototype, 'syncOrders')
      .mockRejectedValue(new CamsError('TEST_MODULE', { message: 'error' }));
    const camsError = jest.spyOn(LoggerImpl.prototype, 'camsError').mockImplementation(() => {});
    await timerTrigger(context);
    expect(syncOrders).toHaveBeenCalled();
    expect(camsError).toHaveBeenCalled();
  });
});
