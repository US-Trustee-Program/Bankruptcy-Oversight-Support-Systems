import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import { ORDERS } from '../../testing/mock-data/orders.mock';
import { getOrdersGateway, getOrdersRepository, getRuntimeStateRepository } from '../../factory';

describe('Orders use case', () => {
  test('should return list of orders for the API from the repo', async () => {
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const ordersGateway = getOrdersGateway(mockContext);
    const runtimeStateRepo = getRuntimeStateRepository(mockContext);
    const ordersRepo = getOrdersRepository(mockContext);
    const useCase = new OrdersUseCase(ordersRepo, ordersGateway, runtimeStateRepo);
    const result = await useCase.getOrders(mockContext);
    expect(result).toEqual(ORDERS);
  });
  test('should return a list of orders from the gateway to write to the repo', () => {});
});
