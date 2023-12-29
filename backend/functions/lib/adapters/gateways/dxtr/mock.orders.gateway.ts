import { OrdersGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { Order } from '../../../use-cases/orders/orders.model';
import { ORDERS } from '../../../testing/mock-data/orders.mock';

export class MockOrdersGateway implements OrdersGateway {
  async getOrders(_applicationContext: ApplicationContext): Promise<Array<Order>> {
    return Promise.resolve(ORDERS);
  }
}
