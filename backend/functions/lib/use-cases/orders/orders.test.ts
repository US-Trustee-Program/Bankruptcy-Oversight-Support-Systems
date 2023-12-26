import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OrdersUseCase } from './orders';
import { MockOrdersGateway } from '../../adapters/gateways/dxtr/mock.orders.gateway';
import { ORDERS } from '../../testing/mock-data/orders.mock';

describe('Orders use case', () => {
  test('should return list of orders', async () => {
    const gateway = new MockOrdersGateway();
    const useCase = new OrdersUseCase(gateway);
    const mockContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
    const result = await useCase.getOrders(mockContext);
    expect(result).toEqual(ORDERS);
  });
});
