import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { OrdersUseCase, SyncOrdersStatus } from '../../use-cases/orders/orders';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { CASE_SUMMARIES } from '../../testing/mock-data/case-summaries.mock';
import {
  ConsolidationOrder,
  ConsolidationOrderActionApproval,
  ConsolidationOrderActionRejection,
  Order,
  TransferOrder,
  TransferOrderAction,
} from '../../../../../common/src/cams/orders';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { sortDates } from '../../../../../common/src/date-helper';
import { OrdersController } from './orders.controller';
import { CamsHttpResponseInit, commonHeaders } from '../../adapters/utils/http-response';
import HttpStatusCodes from '../../../../../common/src/api/http-status-codes';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { ResponseBody } from '../../../../../common/src/api/response';

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

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return successful when handleTimer is called', async () => {
    const syncOrdersSpy = jest
      .spyOn(OrdersUseCase.prototype, 'syncOrders')
      .mockResolvedValue(syncResponse);

    const controller = new OrdersController(applicationContext);
    await expect(controller.handleTimer(applicationContext)).resolves.toBeFalsy();
    expect(syncOrdersSpy).toHaveBeenCalled();
  });

  test('should throw error when handleTimer throws', async () => {
    const error = new UnknownError('TEST_MODULE');
    const syncOrdersSpy = jest
      .spyOn(OrdersUseCase.prototype, 'syncOrders')
      .mockRejectedValue(error);

    const controller = new OrdersController(applicationContext);
    await expect(controller.handleTimer(applicationContext)).rejects.toThrow(error);
    expect(syncOrdersSpy).toHaveBeenCalled();
  });

  test('should get orders', async () => {
    const mockRead = jest
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockResolvedValueOnce({
        resources: mockTransferOrder,
      })
      .mockResolvedValueOnce({ resources: mockConsolidationOrder });

    applicationContext.request = mockCamsHttpRequest();
    const controller = new OrdersController(applicationContext);
    const result = await controller.getOrders(applicationContext);
    expect(result.body.data).toEqual(mockOrders);
    expect(mockRead).toHaveBeenCalled();
  });

  test('should update an order', async () => {
    const updateOrderSpy = jest
      .spyOn(OrdersUseCase.prototype, 'updateTransferOrder')
      .mockImplementation((_context, _id, _data) => {
        return Promise.resolve();
      });
    applicationContext.request = mockCamsHttpRequest();
    const expectedResult: CamsHttpResponseInit = {
      headers: commonHeaders,
      statusCode: HttpStatusCodes.NO_CONTENT,
    };
    const controller = new OrdersController(applicationContext);
    const result = await controller.updateOrder(applicationContext, id, orderTransfer);
    expect(result).toEqual(expectedResult);
    expect(updateOrderSpy).toHaveBeenCalledWith(applicationContext, id, orderTransfer);
  });

  test('should get suggested cases', async () => {
    const suggestedCases = [CASE_SUMMARIES[0]];

    const getSuggestedCasesSpy = jest
      .spyOn(OrdersUseCase.prototype, 'getSuggestedCases')
      .mockResolvedValue(suggestedCases);

    const controller = new OrdersController(applicationContext);
    applicationContext.request = mockCamsHttpRequest({ params: { caseId: 'mockId' } });
    const response = await controller.getSuggestedCases(applicationContext);
    expect(getSuggestedCasesSpy).toHaveBeenCalledWith(applicationContext);
    expect(response).toEqual(
      expect.objectContaining({
        body: { meta: expect.objectContaining({ self: expect.any(String) }), data: suggestedCases },
      }),
    );
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
    applicationContext.request = mockCamsHttpRequest({ params: { caseId: 'mockId' } });
    await expect(controller.getSuggestedCases(applicationContext)).rejects.toThrow(camsError);
  });

  test('should throw UnknownError if any other error is encountered', async () => {
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
    applicationContext.request = mockCamsHttpRequest({ params: { caseId: 'mockId' } });
    await expect(controller.getSuggestedCases(applicationContext)).rejects.toThrow(unknownError);
  });

  test('should call reject consolidation', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    const mockConsolidationOrderActionRejection: ConsolidationOrderActionRejection = {
      ...mockConsolidationOrder,
      rejectedCases: [mockConsolidationOrder.childCases[0].caseId],
      leadCase: undefined,
    };
    const request = mockCamsHttpRequest({ body: mockConsolidationOrderActionRejection });
    applicationContext.request = request;
    const expectedBody: ResponseBody<ConsolidationOrder[]> = { data: [mockConsolidationOrder] };
    jest
      .spyOn(OrdersUseCase.prototype, 'rejectConsolidation')
      .mockResolvedValue([mockConsolidationOrder]);
    const controller = new OrdersController(applicationContext);

    const actualResult = await controller.rejectConsolidation(applicationContext);
    expect(actualResult).toEqual({
      headers: commonHeaders,
      statusCode: HttpStatusCodes.OK,
      body: expectedBody,
    });
  });

  test('should call reject consolidation and handle error', async () => {
    const mockConsolidationOrder = MockData.getConsolidationOrder();
    const mockConsolidationOrderActionRejection: ConsolidationOrderActionRejection = {
      ...mockConsolidationOrder,
      rejectedCases: [],
      leadCase: undefined,
    };
    const request = mockCamsHttpRequest({ body: mockConsolidationOrderActionRejection });
    applicationContext.request = request;
    const controller = new OrdersController(applicationContext);
    await expect(controller.rejectConsolidation(applicationContext)).rejects.toThrow(CamsError);
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
    const request = mockCamsHttpRequest({ body: mockConsolidationOrderActionApproval });
    applicationContext.request = request;
    const controller = new OrdersController(applicationContext);

    const actualResult = await controller.approveConsolidation(applicationContext);

    const expectedBody: ResponseBody<ConsolidationOrder[]> = { data: [mockConsolidationOrder] };
    expect(actualResult).toEqual({
      headers: commonHeaders,
      statusCode: HttpStatusCodes.OK,
      body: expectedBody,
    });
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
    const request1 = mockCamsHttpRequest({ body: mockConsolidationOrderActionApproval });
    applicationContext.request = request1;

    await expect(controller.approveConsolidation(applicationContext)).rejects.toThrow(CamsError);

    // setup missing consolidation type
    const mockConsolidationOrder2 = MockData.getConsolidationOrder();
    const mockConsolidationOrderActionApproval2: ConsolidationOrderActionApproval = {
      ...mockConsolidationOrder2,
      approvedCases: [],
      leadCase: mockConsolidationOrder.childCases[0],
      consolidationType: undefined,
    };
    const request2 = mockCamsHttpRequest({ body: mockConsolidationOrderActionApproval2 });
    applicationContext.request = request2;

    await expect(controller.approveConsolidation(applicationContext)).rejects.toThrow(CamsError);

    // setup missing lead case
    mockConsolidationOrderActionApproval.approvedCases = ['11-11111'];
    mockConsolidationOrderActionApproval.leadCase = undefined;

    await expect(controller.approveConsolidation(applicationContext)).rejects.toThrow(CamsError);
  });
});

describe('orders controller exception tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  test('should wrap unexpected errors with CamsError', async () => {
    const error = new Error('GenericError');
    const camsError = new UnknownError('TEST-MODULE', { originalError: error });
    jest.spyOn(OrdersUseCase.prototype, 'getOrders').mockRejectedValue(error);
    const controller = new OrdersController(applicationContext);
    await expect(controller.getOrders(applicationContext)).rejects.toThrow(camsError);
  });

  test('should throw CamsError when caught', async () => {
    const error = new CamsError('TEST-MODULE');
    jest.spyOn(OrdersController.prototype, 'getOrders').mockRejectedValue(error);
    const controller = new OrdersController(applicationContext);
    await expect(controller.getOrders(applicationContext)).rejects.toThrow(error);
  });
});
