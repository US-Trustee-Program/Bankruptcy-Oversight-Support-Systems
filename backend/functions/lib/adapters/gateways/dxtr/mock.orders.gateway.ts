import { OrdersGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { ORDERS } from '../../../testing/mock-data/orders.mock';
import { OrderSync } from '../../../../../../common/src/cams/orders';

export class MockOrdersGateway implements OrdersGateway {
  async getOrderSync(_applicationContext: ApplicationContext, txId: string): Promise<OrderSync> {
    return Promise.resolve({
      orders: ORDERS,
      maxTxId: (ORDERS.length + parseInt(txId)).toString(),
    });
  }
}
