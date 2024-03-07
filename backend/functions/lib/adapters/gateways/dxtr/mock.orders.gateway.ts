import { OrdersGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { RawOrderSync } from '../../../../../../common/src/cams/orders';
import { MockData } from '../../../../../../common/src/cams/test-utilities/mock-data';

export class MockOrdersGateway implements OrdersGateway {
  async getOrderSync(_applicationContext: ApplicationContext, txId: string): Promise<RawOrderSync> {
    return Promise.resolve({
      consolidations: [MockData.getRawConsolidationOrder()],
      transfers: [MockData.getTransferOrder()],
      maxTxId: (2 + parseInt(txId)).toString(),
    });
  }
}
