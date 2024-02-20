import { HumbleClient } from '../testing/mock.cosmos-client-humble';
import { ConsolidationOrder } from '../../../../common/src/cams/orders';

export default class FakeConsolidationsCosmosClientHumble extends HumbleClient<ConsolidationOrder> {}
