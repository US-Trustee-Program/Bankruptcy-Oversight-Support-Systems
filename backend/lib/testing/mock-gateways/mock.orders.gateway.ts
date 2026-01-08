import { RawOrderSync } from '@common/cams/orders';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { OrdersGateway } from '../../use-cases/gateways.types';

export class MockOrdersGateway implements OrdersGateway {
  async getOrderSync(_applicationContext: ApplicationContext, txId: string): Promise<RawOrderSync> {
    return Promise.resolve({
      consolidations: [MockData.getRawConsolidationOrder()],
      transfers: [MockData.getTransferOrder()],
      maxTxId: (2 + parseInt(txId)).toString(),
    });
  }
}
