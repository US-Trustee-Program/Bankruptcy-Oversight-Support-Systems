import { LoggerImpl } from '../../lib/adapters/services/logger.service';
import { CamsError } from '../../lib/common-errors/cams-error';
import timerTrigger from './orders-sync.function';
import { Timer } from '@azure/functions';
import { createMockAzureFunctionContext } from '../azure/testing-helpers';
import { OrdersController } from '../../lib/controllers/orders/orders.controller';
import * as factory from '../../lib/factory';

describe('Orders Sync Function tests', () => {
  const context = createMockAzureFunctionContext({ MONGO_CONNECTION_STRING: 'fake' });
  const timer: Timer = {
    isPastDue: false,
    schedule: {
      adjustForDST: false,
    },
    scheduleStatus: {
      last: '',
      next: '',
      lastUpdated: '',
    },
  };

  test('Should call orders controller method handleTimer', async () => {
    jest.spyOn(factory, 'getOrdersRepository').mockReturnValue({
      search: jest.fn(),
      read: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
      release: jest.fn(),
    });
    const handleTimer = jest
      .spyOn(OrdersController.prototype, 'handleTimer')
      .mockImplementation(() => Promise.resolve());
    await timerTrigger(timer, context);
    expect(handleTimer).toHaveBeenCalled();
  });

  test('Should log a camsError if handleTimer throws a CamsError', async () => {
    jest.spyOn(factory, 'getOrdersRepository').mockReturnValue({
      search: jest.fn(),
      read: jest.fn(),
      update: jest.fn(),
      createMany: jest.fn(),
      release: jest.fn(),
    });
    const handleTimer = jest
      .spyOn(OrdersController.prototype, 'handleTimer')
      .mockRejectedValue(new CamsError('TEST_MODULE', { message: 'error' }));
    const camsError = jest.spyOn(LoggerImpl.prototype, 'camsError').mockImplementation(() => {});
    await timerTrigger(timer, context);
    expect(handleTimer).toHaveBeenCalled();
    expect(camsError).toHaveBeenCalled();
  });
});
