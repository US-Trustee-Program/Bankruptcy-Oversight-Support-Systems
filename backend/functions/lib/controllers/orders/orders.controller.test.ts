import { OrdersController } from './orders.controller';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { HumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { OrdersUseCase, SyncOrdersStatus } from '../../use-cases/orders/orders';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CASE_SUMMARIES } from '../../testing/mock-data/case-summaries.mock';
import { CamsResponse } from '../controller-types';
import { CaseDetail } from '../../adapters/types/cases';
import { TransferOrderAction } from '../../../../../common/src/cams/orders';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';

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

describe('orders controller tests', () => {
  const mockOrders = [MockData.getTransferOrder()];
  const id = '12345';
  const orderTransfer: TransferOrderAction = {
    id,
    caseId: mockOrders[0].caseId,
    status: 'rejected',
  };
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('should get orders', async () => {
    const mockRead = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: mockOrders,
    });
    const controller = new OrdersController(applicationContext);
    const result = await controller.getOrders(applicationContext);
    expect(result.success).toBeTruthy();
    expect(result['body']).toEqual(mockOrders);
    expect(mockRead).toHaveBeenCalled();
  });

  test('should update an order', async () => {
    const updateOrderSpy = jest
      .spyOn(OrdersUseCase.prototype, 'updateTransferOrder')
      .mockResolvedValue(id);
    const expectedResult = {
      success: true,
      body: id,
    };

    const controller = new OrdersController(applicationContext);
    const result = await controller.updateOrder(applicationContext, id, orderTransfer);
    expect(result).toEqual(expectedResult);
    expect(updateOrderSpy).toHaveBeenCalledWith(applicationContext, id, orderTransfer);
  });

  test('should sync orders', async () => {
    const syncOrdersSpy = jest
      .spyOn(OrdersUseCase.prototype, 'syncOrders')
      .mockResolvedValue(syncResponse);

    const controller = new OrdersController(applicationContext);
    await controller.syncOrders(applicationContext);
    expect(syncOrdersSpy).toHaveBeenCalledWith(applicationContext, undefined);
  });

  test('should get suggested cases', async () => {
    const suggestedCases = [CASE_SUMMARIES[0]];
    const suggestedCasesResponse: CamsResponse<CaseDetail[]> = {
      body: suggestedCases,
      success: true,
    };

    const getSuggestedCasesSpy = jest
      .spyOn(OrdersUseCase.prototype, 'getSuggestedCases')
      .mockResolvedValue(suggestedCases);

    const controller = new OrdersController(applicationContext);
    const response = await controller.getSuggestedCases(applicationContext, 'mockId');
    expect(getSuggestedCasesSpy).toHaveBeenCalledWith(applicationContext, 'mockId');
    expect(response).toEqual(suggestedCasesResponse);
  });

  test('should rethrow CamsError if CamsError is encountered', async () => {
    const camsError = new CamsError('TEST');
    jest.spyOn(OrdersUseCase.prototype, 'getOrders').mockRejectedValue(camsError);
    jest.spyOn(OrdersUseCase.prototype, 'updateTransferOrder').mockRejectedValue(camsError);
    jest.spyOn(OrdersUseCase.prototype, 'syncOrders').mockRejectedValue(camsError);
    jest.spyOn(OrdersUseCase.prototype, 'getSuggestedCases').mockRejectedValue(camsError);

    const controller = new OrdersController(applicationContext);
    await expect(controller.getOrders(applicationContext)).rejects.toThrow(camsError);
    await expect(controller.updateOrder(applicationContext, id, orderTransfer)).rejects.toThrow(
      camsError,
    );
    await expect(controller.syncOrders(applicationContext)).rejects.toThrow(camsError);
    await expect(controller.getSuggestedCases(applicationContext, 'mockId')).rejects.toThrow(
      camsError,
    );
  });

  test('should throw UnknownError if any other error is ecountered', async () => {
    const originalError = new Error('Test');
    const unknownError = new UnknownError('TEST', { originalError });
    jest.spyOn(OrdersUseCase.prototype, 'getOrders').mockRejectedValue(originalError);
    jest.spyOn(OrdersUseCase.prototype, 'updateTransferOrder').mockRejectedValue(originalError);
    jest.spyOn(OrdersUseCase.prototype, 'syncOrders').mockRejectedValue(originalError);
    jest.spyOn(OrdersUseCase.prototype, 'getSuggestedCases').mockRejectedValue(originalError);

    const controller = new OrdersController(applicationContext);
    await expect(controller.getOrders(applicationContext)).rejects.toThrow(unknownError);
    await expect(controller.updateOrder(applicationContext, id, orderTransfer)).rejects.toThrow(
      unknownError,
    );
    await expect(controller.syncOrders(applicationContext)).rejects.toThrow(unknownError);
    await expect(controller.getSuggestedCases(applicationContext, 'mockId')).rejects.toThrow(
      unknownError,
    );
  });
});
