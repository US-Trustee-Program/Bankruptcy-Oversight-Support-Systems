import { OrdersGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { OrderSync } from '../../../../../../common/src/cams/orders';
import { MockData } from '../../../../../../common/src/cams/test-utilities/mock-data';

export class MockOrdersGateway implements OrdersGateway {
  async getOrderSync(_applicationContext: ApplicationContext, txId: string): Promise<OrderSync> {
    return Promise.resolve({
      consolidations: [MockData.getConsolidationOrder()],
      transfers: [MockData.getTransferOrder()],
      maxTxId: (2 + parseInt(txId)).toString(),
    });
  }
}
