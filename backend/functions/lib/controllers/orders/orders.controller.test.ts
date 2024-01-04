import { OrdersController } from './orders.controller';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ORDERS } from '../../testing/mock-data/orders.mock';
import { ApplicationContext } from '../../adapters/types/basic';
import { HumbleQuery } from '../../testing/mock.cosmos-client-humble';

describe('orders controller tests', () => {
  let applicationContext: ApplicationContext;

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({ DATABASE_MOCK: 'true' });
  });

  test('should return all orders', async () => {
    const mockRead = jest.spyOn(HumbleQuery.prototype, 'fetchAll').mockReturnValue({
      resources: ORDERS,
    });
    const controller = new OrdersController(applicationContext);
    const result = await controller.getOrders(applicationContext);
    expect(result.success).toBeTruthy();
    expect(result['body']).toEqual(ORDERS);
    expect(mockRead).toHaveBeenCalled();
  });
});
