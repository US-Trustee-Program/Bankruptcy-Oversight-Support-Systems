import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { OrdersUseCase, SyncOrdersStatus } from '../../use-cases/orders/orders';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CASE_SUMMARIES } from '../../testing/mock-data/case-summaries.mock';
import {
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  Order,
  TransferOrder,
  TransferOrderAction,
} from '../../../../../common/src/cams/orders';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { sortDates } from '../../../../../common/src/date-helper';
import { ManageConsolidationResponse, OrdersController } from './orders.controller';
import { CamsResponse } from '../controller-types';
import { CaseDetail } from '../../../../../common/src/cams/cases';

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
  const mockTransferOrder = new Array<Order>(MockData.getTransferOrder());
  const mockConsolidationOrder = new Array<Order>(MockData.getConsolidationOrder());
  const mockOrders = mockTransferOrder
    .concat(mockConsolidationOrder)
    .sort((a, b) => sortDates(a.orderDate, b.orderDate));
  const id = '12345';
  const orderTransfer: TransferOrderAction = {
    id,
    orderType: 'transfer',
    caseId: (mockTransferOrder[0] as TransferOrder).caseId,
    status: 'rejected',
  };
  let applicationContext: ApplicationContext;

  beforeAll(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('should get orders', async () => {
    const mockRead = jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockResolvedValueOnce({
        resources: mockTransferOrder,
      })
      .mockResolvedValueOnce({ resources: mockConsolidationOrder });

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

  test('should call reject consolidation', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    const mockConsolidationOrderActionRejection: ConsolidationOrderActionRejection = {
      ...mockConsolidationOrder,
      rejectedCases: [mockConsolidationOrder.childCases[0].caseId],
      leadCase: undefined,
    };
    const expectedResult: ManageConsolidationResponse = {
      success: true,
      body: [mockConsolidationOrder],
    };
    jest
      .spyOn(OrdersUseCase.prototype, 'rejectConsolidation')
      .mockResolvedValue([mockConsolidationOrder]);
    const controller = new OrdersController(applicationContext);

    const actualResult = await controller.rejectConsolidation(
      applicationContext,
      mockConsolidationOrderActionRejection,
    );
    expect(actualResult).toEqual(expectedResult);
    expect(actualResult.success).toBeTruthy();
  });
  test('should call reject consolidation and handle error', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    const mockConsolidationOrderActionRejection: ConsolidationOrderActionRejection = {
      ...mockConsolidationOrder,
      rejectedCases: [],
      leadCase: undefined,
    };
    const controller = new OrdersController(applicationContext);
    expect(
      controller.rejectConsolidation(applicationContext, mockConsolidationOrderActionRejection),
    ).rejects.toThrow(CamsError);
  });

  test('should call approve consolidation', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    const mockConsolidationOrderActionApproval: ConsolidationOrderActionApproval = {
      ...mockConsolidationOrder,
      approvedCases: [mockConsolidationOrder.childCases[0].caseId],
      leadCase: mockConsolidationOrder.childCases[0],
    };
    jest
      .spyOn(OrdersUseCase.prototype, 'approveConsolidation')
      .mockResolvedValue([mockConsolidationOrder]);
    const controller = new OrdersController(applicationContext);

    const actualResult = await controller.approveConsolidation(
      applicationContext,
      mockConsolidationOrderActionApproval,
    );

    expect(actualResult.success).toBeTruthy();
    const expectedResult: ManageConsolidationResponse = {
      success: true,
      body: [mockConsolidationOrder],
    };
    expect(actualResult).toEqual(expectedResult);
  });

  test('should call approve consolidation and handle error', async () => {
    const controller = new OrdersController(applicationContext);

    // setup missing approved cases
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    const mockConsolidationOrderActionApproval: ConsolidationOrderActionApproval = {
      ...mockConsolidationOrder,
      approvedCases: [],
      leadCase: mockConsolidationOrder.childCases[0],
    };

    expect(
      controller.approveConsolidation(applicationContext, mockConsolidationOrderActionApproval),
    ).rejects.toThrow(CamsError);

    // setup missing consolidation type
    const mockConsolidationOrder2 = MockData.getConsolidationOrder();
    const mockConsolidationOrderActionApproval2: ConsolidationOrderActionApproval = {
      ...mockConsolidationOrder2,
      approvedCases: [],
      leadCase: mockConsolidationOrder.childCases[0],
      consolidationType: undefined,
    };

    expect(
      controller.approveConsolidation(applicationContext, mockConsolidationOrderActionApproval2),
    ).rejects.toThrow(CamsError);

    // setup missing lead case
    mockConsolidationOrderActionApproval.approvedCases = ['11-11111'];
    mockConsolidationOrderActionApproval.leadCase = undefined;

    expect(
      controller.approveConsolidation(applicationContext, mockConsolidationOrderActionApproval),
    ).rejects.toThrow(CamsError);
  });
});
