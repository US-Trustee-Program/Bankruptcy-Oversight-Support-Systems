import { TransferOrder } from '../use-cases/orders/orders.model';
import { HumbleClient } from '../testing/mock.cosmos-client-humble';

export default class FakeOrdersCosmosClientHumble extends HumbleClient<TransferOrder> {}
