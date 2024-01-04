import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import { ORDERS } from '../../testing/mock-data/orders.mock';
import { HumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { getOrdersGateway, getOrdersRepository, getRuntimeStateRepository } from '../../factory';
import { OrdersCosmosDbRepository } from '../../adapters/gateways/orders.cosmosdb.repository';
import { RuntimeStateCosmosDbRepository } from '../../adapters/gateways/runtime-state.cosmosdb.repository';
import { MockOrdersGateway } from '../../adapters/gateways/dxtr/mock.orders.gateway';

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
});
