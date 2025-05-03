import { RawOrderSync } from '../../../../common/src/cams/orders';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { OrdersGateway } from '../../use-cases/gateways.types';

export class MockOrdersGateway implements OrdersGateway {
  async getOrderSync(_applicationContext: ApplicationContext, txId: string): Promise<RawOrderSync> {
    return Promise.resolve({
      consolidations: [MockData.getRawConsolidationOrder()],
      maxTxId: (2 + parseInt(txId)).toString(),
      transfers: [MockData.getTransferOrder()],
    });
  }
}
