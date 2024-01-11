import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import { ORDERS } from '../../testing/mock-data/orders.mock';
import { HumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { getOrdersGateway, getOrdersRepository, getRuntimeStateRepository } from '../../factory';
import { OrdersCosmosDbRepository } from '../../adapters/gateways/orders.cosmosdb.repository';
import { RuntimeStateCosmosDbRepository } from '../../adapters/gateways/runtime-state.cosmosdb.repository';
import { MockOrdersGateway } from '../../adapters/gateways/dxtr/mock.orders.gateway';
import { OrderSyncState } from '../gateways.types';
import { CamsError } from '../../common-errors/cams-error';

describe('Orders use case', () => {
  let mockContext;
  let ordersGateway;
  let ordersRepo;
  let runtimeStateRepo;
  let useCase;

  beforeEach(async () => {
    mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    ordersGateway = getOrdersGateway(mockContext);
    runtimeStateRepo = getRuntimeStateRepository(mockContext);
    ordersRepo = getOrdersRepository(mockContext);
    useCase = new OrdersUseCase(ordersRepo, ordersGateway, runtimeStateRepo);
  });

  test('should return list of orders for the API from the repo', async () => {
    const mockRead = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockReturnValue({
      resources: ORDERS,
    });
    const result = await useCase.getOrders(mockContext);
    expect(result).toEqual(ORDERS);
    expect(mockRead).toHaveBeenCalled();
  });

  test('should update an order', async () => {
    const order = { id: 'mock-guid' };
    const updateOrder = jest
      .spyOn(OrdersCosmosDbRepository.prototype, 'updateOrder')
      .mockResolvedValue(order);

    const result = await useCase.updateOrder(mockContext, order);
    expect(result).toEqual(order);
    expect(updateOrder).toHaveBeenCalled();
  });

  test('should retrieve orders from legacy and persist to new system', async () => {
    const startState = { documentType: 'ORDERS_SYNC_STATE', txId: 1234, id: 'guid-1' };

    jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockReturnValue({
      resources: [startState],
    });

    jest.spyOn(MockOrdersGateway.prototype, 'getOrderSync').mockResolvedValue({
      orders: ORDERS,
      maxTxId: 3000,
    });

    const endState = {
      ...startState,
      txId: 3000,
    };

    const mockPutOrders = jest
      .spyOn(OrdersCosmosDbRepository.prototype, 'putOrders')
      .mockImplementation(async () => {});

    const mockUpdateState = jest
      .spyOn(RuntimeStateCosmosDbRepository.prototype, 'updateState')
      .mockImplementation(jest.fn());

    await useCase.syncOrders(mockContext);

    expect(mockPutOrders).toHaveBeenCalledWith(mockContext, ORDERS);
    expect(mockUpdateState).toHaveBeenCalledWith(mockContext, endState);
  });

  test('should handle a missing order runtime state when a starting transaction ID is provided', async () => {
    const id = 'guid-id';
    const txId = 1234;
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
        maxTxId: 3000,
      });

    const endState = {
      ...initialState,
      txId: 3000,
      id,
    };

    const mockPutOrders = jest
      .spyOn(OrdersCosmosDbRepository.prototype, 'putOrders')
      .mockImplementation(async () => {});

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
