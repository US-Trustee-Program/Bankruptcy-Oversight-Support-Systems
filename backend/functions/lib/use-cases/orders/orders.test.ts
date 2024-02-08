import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import { ORDERS } from '../../testing/mock-data/orders.mock';
import { HumbleQuery } from '../../testing/mock.cosmos-client-humble';
import {
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
  getCasesRepository,
  getCasesGateway,
} from '../../factory';
import { OrdersCosmosDbRepository } from '../../adapters/gateways/orders.cosmosdb.repository';
import { RuntimeStateCosmosDbRepository } from '../../adapters/gateways/runtime-state.cosmosdb.repository';
import { MockOrdersGateway } from '../../adapters/gateways/dxtr/mock.orders.gateway';
import { OrderSyncState } from '../gateways.types';
import { CamsError } from '../../common-errors/cams-error';
import { TransferOrder, TransferOrderAction, TransferIn, TransferOut } from './orders.model';
import { CASE_SUMMARIES } from '../../testing/mock-data/case-summaries.mock';

describe('Orders use case', () => {
  const CASE_ID = '000-11-22222';
  let mockContext;
  let ordersGateway;
  let ordersRepo;
  let casesRepo;
  let runtimeStateRepo;
  let casesGateway;
  let useCase: OrdersUseCase;

  beforeEach(async () => {
    mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    ordersGateway = getOrdersGateway(mockContext);
    runtimeStateRepo = getRuntimeStateRepository(mockContext);
    ordersRepo = getOrdersRepository(mockContext);
    casesRepo = getCasesRepository(mockContext);
    casesGateway = getCasesGateway(mockContext);
    useCase = new OrdersUseCase(
      casesRepo,
      casesGateway,
      ordersRepo,
      ordersGateway,
      runtimeStateRepo,
    );
  });

  test('should return list of orders for the API from the repo', async () => {
    const mockRead = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: ORDERS,
    });
    const result = await useCase.getOrders(mockContext);
    expect(result).toEqual(ORDERS);
    expect(mockRead).toHaveBeenCalled();
  });

  test('should return list of suggested cases for an order', async () => {
    const suggestedCases = [CASE_SUMMARIES[0]];
    const gateway = jest.spyOn(casesGateway, 'getSuggestedCases').mockResolvedValue(suggestedCases);
    const result = await useCase.getSuggestedCases(mockContext, CASE_ID);
    expect(result).toEqual(suggestedCases);
    expect(gateway).toHaveBeenCalled();
  });

  test('should add transfer records for both cases when a transfer order is completed', async () => {
    const order: TransferOrder = { ...ORDERS[0], status: 'approved' };
    const action: TransferOrderAction = {
      id: order.id,
      caseId: order.caseId,
      newCase: order.newCase,
      status: 'approved',
    };

    const transferIn: TransferIn = {
      caseId: order.newCase.caseId,
      otherCaseId: order.caseId,
      divisionName: order.courtDivisionName,
      courtName: order.courtName,
      orderDate: order.orderDate,
      documentType: 'TRANSFER_IN',
    };

    const transferOut: TransferOut = {
      caseId: order.caseId,
      otherCaseId: order.newCase.caseId,
      divisionName: order.newCase.courtDivisionName,
      courtName: order.newCase.courtName,
      orderDate: order.orderDate,
      documentType: 'TRANSFER_OUT',
    };

    const updateOrderFn = jest
      .spyOn(ordersRepo, 'updateOrder')
      .mockResolvedValue({ id: 'mock-guid' });
    const getOrderFn = jest.spyOn(ordersRepo, 'getOrder').mockResolvedValue(order);
    const transferOutFn = jest.spyOn(casesRepo, 'createTransferOut');
    const transferInFn = jest.spyOn(casesRepo, 'createTransferIn');
    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory');

    await useCase.updateOrder(mockContext, order.id, action);
    expect(updateOrderFn).toHaveBeenCalledWith(mockContext, order.id, action);
    expect(getOrderFn).toHaveBeenCalledWith(mockContext, order.id, order.caseId);
    expect(transferOutFn).toHaveBeenCalledWith(mockContext, transferOut);
    expect(transferInFn).toHaveBeenCalledWith(mockContext, transferIn);
    expect(auditFn).toHaveBeenCalled();
  });

  test('should add audit records when a transfer order is rejected', async () => {
    const order: TransferOrder = { ...ORDERS[0], status: 'rejected' };
    const orderTransfer: TransferOrderAction = {
      id: order.id,
      caseId: order.caseId,
      status: 'rejected',
    };

    const updateOrderFn = jest
      .spyOn(ordersRepo, 'updateOrder')
      .mockResolvedValue({ id: 'mock-guid' });
    const getOrderFn = jest.spyOn(ordersRepo, 'getOrder').mockResolvedValue(order);

    const auditFn = jest.spyOn(casesRepo, 'createCaseHistory');

    await useCase.updateOrder(mockContext, order.id, orderTransfer);
    expect(updateOrderFn).toHaveBeenCalledWith(mockContext, order.id, orderTransfer);
    expect(getOrderFn).toHaveBeenCalledWith(mockContext, order.id, order.caseId);
    expect(auditFn).toHaveBeenCalled();
  });

  test('should retrieve orders from legacy and persist to new system', async () => {
    const startState = { documentType: 'ORDERS_SYNC_STATE', txId: '1234', id: 'guid-1' };

    jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [startState],
    });

    jest.spyOn(MockOrdersGateway.prototype, 'getOrderSync').mockResolvedValue({
      orders: ORDERS,
      maxTxId: '3000',
    });

    const endState = {
      ...startState,
      txId: '3000',
    };

    const mockPutOrders = jest
      .spyOn(OrdersCosmosDbRepository.prototype, 'putOrders')
      .mockResolvedValue(ORDERS);

    const mockUpdateState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'updateState')
      .mockImplementation(jest.fn());

    await useCase.syncOrders(mockContext);

    expect(mockPutOrders).toHaveBeenCalledWith(mockContext, ORDERS);
    expect(mockUpdateState).toHaveBeenCalledWith(mockContext, endState);
  });

  test('should handle a missing order runtime state when a starting transaction ID is provided', async () => {
    const id = 'guid-id';
    const txId = '1234';
    const initialState: OrderSyncState = { documentType: 'ORDERS_SYNC_STATE', txId };

    const mockGetState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'getState')
      .mockRejectedValue(
        new CamsError('COSMOS_DB_REPOSITORY_RUNTIME_STATE', {
          message: 'Initial state was not found or was ambiguous.',
        }),
      );

    const mockCreateState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'createState')
      .mockResolvedValue({ ...initialState, id });

    const mockGetOrderSync = jest
      .spyOn(MockOrdersGateway.prototype, 'getOrderSync')
      .mockResolvedValue({
        orders: ORDERS,
        maxTxId: '3000',
      });

    const endState = {
      ...initialState,
      txId: '3000',
      id,
    };

    const mockPutOrders = jest
      .spyOn(OrdersCosmosDbRepository.prototype, 'putOrders')
      .mockResolvedValue(ORDERS);

    const mockUpdateState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'updateState')
      .mockImplementation(jest.fn());

    await useCase.syncOrders(mockContext, { txIdOverride: txId });

    expect(mockGetState).toHaveBeenCalled();
    expect(mockCreateState).toHaveBeenCalledWith(mockContext, initialState);
    expect(mockGetOrderSync).toHaveBeenCalled();
    expect(mockPutOrders).toHaveBeenCalled();
    expect(mockUpdateState).toHaveBeenCalledWith(mockContext, endState);
  });

  test('should throw an error with a missing order runtime state and no starting transaction ID is provided', async () => {
    const mockGetState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'getState')
      .mockRejectedValue(
        new CamsError('COSMOS_DB_REPOSITORY_RUNTIME_STATE', {
          message: 'Initial state was not found or was ambiguous.',
        }),
      );

    await expect(useCase.syncOrders(mockContext)).rejects.toThrow(
      'A transaction ID is required to seed the order sync run. Aborting.',
    );
    expect(mockGetState).toHaveBeenCalled();
  });

  test('should throw any other error when attempting to retrieve initial runtime state', async () => {
    const mockGetState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'getState')
      .mockRejectedValue(new Error('TEST'));

    await expect(useCase.syncOrders(mockContext)).rejects.toThrow('TEST');
    expect(mockGetState).toHaveBeenCalled();
  });
});
