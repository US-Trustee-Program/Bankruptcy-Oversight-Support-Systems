import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
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
} from '@common/cams/orders';
import MockData from '@common/cams/test-utilities/mock-data';
import DateHelper from '@common/date-helper';
import { OrdersController } from './orders.controller';
import { CamsHttpResponseInit, commonHeaders } from '../../adapters/utils/http-response';
import HttpStatusCodes from '@common/api/http-status-codes';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { ResponseBody } from '@common/api/response';
import { NotFoundError } from '../../common-errors/not-found-error';
import { BadRequestError } from '../../common-errors/bad-request';
import * as crypto from 'crypto';

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
    .sort((a, b) => DateHelper.sortDates(a.orderDate, b.orderDate));
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
    vi.restoreAllMocks();
  });

  test('should return successful when handleTimer is called', async () => {
    const syncOrdersSpy = vi
      .spyOn(OrdersUseCase.prototype, 'syncOrders')
      .mockResolvedValue(syncResponse);

    const controller = new OrdersController(applicationContext);
    await expect(controller.handleTimer(applicationContext)).resolves.toBeFalsy();
    expect(syncOrdersSpy).toHaveBeenCalled();
  });

  test('should throw error when handleTimer throws', async () => {
    const error = new UnknownError('TEST_MODULE');
    const syncOrdersSpy = vi.spyOn(OrdersUseCase.prototype, 'syncOrders').mockRejectedValue(error);

    const controller = new OrdersController(applicationContext);
    await expect(controller.handleTimer(applicationContext)).rejects.toThrow(error);
    expect(syncOrdersSpy).toHaveBeenCalled();
  });

  test('should get orders', async () => {
    const mockRead = vi.spyOn(OrdersUseCase.prototype, 'getOrders').mockResolvedValue(mockOrders);

    applicationContext.request = mockCamsHttpRequest();
    const controller = new OrdersController(applicationContext);
    const result = await controller.getOrders(applicationContext);
    expect(result.body.data).toEqual(mockOrders);
    expect(mockRead).toHaveBeenCalled();
  });

  test('should update an order', async () => {
    const updateOrderSpy = vi
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

  test('should throw BadRequestError when updating an order and the id does not match data.id', async () => {
    applicationContext.request = mockCamsHttpRequest();
    const expectedError = new BadRequestError('ORDERS-CONTROLLER', {
      message: 'Cannot update order. ID of order does not match ID of request.',
    });
    const failTransfer = { ...orderTransfer };
    failTransfer.id = crypto.randomUUID().toString();
    const controller = new OrdersController(applicationContext);
    await expect(
      async () => await controller.updateOrder(applicationContext, id, failTransfer),
    ).rejects.toThrow(expectedError);
  });

  test('should get suggested cases', async () => {
    const suggestedCases = [CASE_SUMMARIES[0]];

    const getSuggestedCasesSpy = vi
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
    vi.spyOn(OrdersUseCase.prototype, 'getOrders').mockRejectedValue(camsError);
    vi.spyOn(OrdersUseCase.prototype, 'updateTransferOrder').mockRejectedValue(camsError);
    vi.spyOn(OrdersUseCase.prototype, 'syncOrders').mockRejectedValue(camsError);
    vi.spyOn(OrdersUseCase.prototype, 'getSuggestedCases').mockRejectedValue(camsError);

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
    vi.spyOn(OrdersUseCase.prototype, 'getOrders').mockRejectedValue(originalError);
    vi.spyOn(OrdersUseCase.prototype, 'updateTransferOrder').mockRejectedValue(originalError);
    vi.spyOn(OrdersUseCase.prototype, 'syncOrders').mockRejectedValue(originalError);
    vi.spyOn(OrdersUseCase.prototype, 'getSuggestedCases').mockRejectedValue(originalError);

    const controller = new OrdersController(applicationContext);
    await expect(controller.getOrders(applicationContext)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        status: 500,
        module: 'ORDERS-CONTROLLER',
        originalError: expect.stringContaining('Error: Test'),
      }),
    );
    await expect(controller.updateOrder(applicationContext, id, orderTransfer)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        status: 500,
        module: 'ORDERS-CONTROLLER',
        originalError: expect.stringContaining('Error: Test'),
      }),
    );
    await expect(controller.syncOrders(applicationContext)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        status: 500,
        module: 'ORDERS-CONTROLLER',
        originalError: expect.stringContaining('Error: Test'),
      }),
    );
    applicationContext.request = mockCamsHttpRequest({ params: { caseId: 'mockId' } });
    await expect(controller.getSuggestedCases(applicationContext)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        status: 500,
        module: 'ORDERS-CONTROLLER',
        originalError: expect.stringContaining('Error: Test'),
      }),
    );
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
      approvedCases: [mockConsolidationOrder.memberCases[0].caseId],
      leadCase: mockConsolidationOrder.memberCases[0],
    };
    vi.spyOn(OrdersUseCase.prototype, 'approveConsolidation').mockResolvedValue([
      mockConsolidationOrder,
    ]);
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
      leadCase: mockConsolidationOrder.memberCases[0],
    };
    const request1 = mockCamsHttpRequest({ body: mockConsolidationOrderActionApproval });
    applicationContext.request = request1;

    await expect(controller.approveConsolidation(applicationContext)).rejects.toThrow(CamsError);

    // setup missing consolidation type
    const mockConsolidationOrder2 = MockData.getConsolidationOrder();
    const mockConsolidationOrderActionApproval2: ConsolidationOrderActionApproval = {
      ...mockConsolidationOrder2,
      approvedCases: [],
      leadCase: mockConsolidationOrder.memberCases[0],
      consolidationType: undefined,
    };
    const request2 = mockCamsHttpRequest({ body: mockConsolidationOrderActionApproval2 });
    applicationContext.request = request2;

    await expect(controller.approveConsolidation(applicationContext)).rejects.toThrow(CamsError);

    // setup missing lead case
    const mockConsolidationOrderActionApproval3: ConsolidationOrderActionApproval = {
      ...mockConsolidationOrder,
      approvedCases: [mockConsolidationOrder.memberCases[0].caseId],
      leadCase: undefined,
    };
    const request3 = mockCamsHttpRequest({ body: mockConsolidationOrderActionApproval3 });
    applicationContext.request = request3;

    await expect(controller.approveConsolidation(applicationContext)).rejects.toThrow(CamsError);
  });
});

describe('orders controller exception tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext();
  });

  test('should throw unknown error when path is invalid', async () => {
    const expectedUrl = 'http://mockhost/api/failure';
    const expectedError = new NotFoundError('ORDERS-CONTROLLER', {
      message: 'Could not map requested path to action ' + expectedUrl,
    });
    const request = mockCamsHttpRequest({ url: expectedUrl });
    applicationContext.request = request;
    const controller = new OrdersController(applicationContext);

    await expect(async () => await controller.handleRequest(applicationContext)).rejects.toThrow(
      expectedError,
    );
  });

  test('should wrap unexpected errors with CamsError', async () => {
    const error = new Error('GenericError');
    vi.spyOn(OrdersUseCase.prototype, 'getOrders').mockRejectedValue(error);
    const controller = new OrdersController(applicationContext);
    await expect(controller.getOrders(applicationContext)).rejects.toThrow(
      expect.objectContaining({
        message: 'Unknown Error',
        status: 500,
        module: 'ORDERS-CONTROLLER',
        originalError: expect.stringContaining('Error: GenericError'),
      }),
    );
  });

  test('should throw CamsError when caught', async () => {
    const error = new CamsError('TEST-MODULE');
    vi.spyOn(OrdersController.prototype, 'getOrders').mockRejectedValue(error);
    const controller = new OrdersController(applicationContext);
    await expect(controller.getOrders(applicationContext)).rejects.toThrow(error);
  });
});
