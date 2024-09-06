import { LoggerImpl } from '../lib/adapters/services/logger.service';
import { CamsError } from '../lib/common-errors/cams-error';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { SyncOrdersStatus } from '../lib/use-cases/orders/orders';
import handler from './orders-manual-sync.function';
import { buildTestResponseSuccess, createMockAzureFunctionRequest } from '../azure/testing-helpers';

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
  /* eslint-disable-next-line @typescript-eslint/no-require-imports */
  const context = require('azure-function-context-mock');

  test('Should call orders controller method syncOrders', async () => {
    const { camsHttpResponse } = buildTestResponseSuccess<SyncOrdersStatus>({ data: syncResponse });
    const request = createMockAzureFunctionRequest({
      url: 'http://domain/api/order-manual-sync',
      params: {},
      method: 'POST',
    });
    const syncOrders = jest
      .spyOn(OrdersController.prototype, 'syncOrders')
      .mockResolvedValue(camsHttpResponse);
    await handler(request, context);
    expect(syncOrders).toHaveBeenCalled();
  });

  test('Should log a camsError if syncOrders throws a CamsError', async () => {
    const request = createMockAzureFunctionRequest({
      url: 'http://domain/api/order-manual-sync',
      params: {},
      method: 'POST',
    });

    const syncOrders = jest
      .spyOn(OrdersController.prototype, 'syncOrders')
      .mockRejectedValue(new CamsError('TEST_MODULE', { message: 'error' }));
    const camsError = jest.spyOn(LoggerImpl.prototype, 'camsError').mockImplementation(() => {});
    await handler(request, context);
    expect(syncOrders).toHaveBeenCalled();
    expect(camsError).toHaveBeenCalled();
  });
});
