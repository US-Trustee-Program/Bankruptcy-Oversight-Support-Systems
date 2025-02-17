import { Timer } from '@azure/functions';
import Factory from '../../../lib/factory';
import {
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { LoggerImpl } from '../../../lib/adapters/services/logger.service';
import { SyncOrdersStatus } from '../../../lib/use-cases/orders/orders';
import { httpTrigger, timerTrigger } from './sync-orders';

const syncResponse: SyncOrdersStatus = {
  options: {
    txIdOverride: '10',
  },
  initialSyncState: {
    documentType: 'ORDERS_SYNC_STATE',
    txId: '464',
    id: '28e35739-58cd-400b-9d4b-26969773618b',
  },
  finalSyncState: {
    documentType: 'ORDERS_SYNC_STATE',
    txId: '464',
    id: '28e35739-58cd-400b-9d4b-26969773618b',
  },
  length: 13,
  startingTxId: '10',
  maxTxId: '464',
};

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
    jest.spyOn(Factory, 'getOrdersRepository').mockReturnValue({
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
    jest.spyOn(Factory, 'getOrdersRepository').mockReturnValue({
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

describe('Orders Sync Function tests #2', () => {
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const context = require('azure-function-context-mock');

  test('Should call orders controller method syncOrders', async () => {
    const { camsHttpResponse } = buildTestResponseSuccess<SyncOrdersStatus>({ data: syncResponse });
    const request = createMockAzureFunctionRequest({
      url: 'http://domain/api/sync-orders',
      params: {},
      method: 'POST',
    });
    const syncOrders = jest
      .spyOn(OrdersController.prototype, 'syncOrders')
      .mockResolvedValue(camsHttpResponse);
    await httpTrigger(request, context);
    expect(syncOrders).toHaveBeenCalled();
  });

  test('Should log a camsError if syncOrders throws a CamsError', async () => {
    const request = createMockAzureFunctionRequest({
      url: 'http://domain/api/sync-orders',
      params: {},
      method: 'POST',
    });

    const syncOrders = jest
      .spyOn(OrdersController.prototype, 'syncOrders')
      .mockRejectedValue(new CamsError('TEST_MODULE', { message: 'error' }));
    const camsError = jest.spyOn(LoggerImpl.prototype, 'camsError').mockImplementation(() => {});
    await httpTrigger(request, context);
    expect(syncOrders).toHaveBeenCalled();
    expect(camsError).toHaveBeenCalled();
  });
});
