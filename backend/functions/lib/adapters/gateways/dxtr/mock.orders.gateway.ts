import { OrdersGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { ORDERS } from '../../../testing/mock-data/orders.mock';
import { OrderSync } from '../../../use-cases/orders/orders.model';

export class MockOrdersGateway implements OrdersGateway {
  async getOrderSync(_applicationContext: ApplicationContext, txId: number): Promise<OrderSync> {
    return Promise.resolve({
      orders: ORDERS,
      maxTxId: txId + ORDERS.length,
    });
  }
}
