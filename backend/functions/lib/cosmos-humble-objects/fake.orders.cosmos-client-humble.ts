import { HumbleClient } from '../testing/mock.cosmos-client-humble';
import { TransferOrder } from '../../../../common/src/cams/orders';

export default class FakeOrdersCosmosClientHumble extends HumbleClient<TransferOrder> {}
