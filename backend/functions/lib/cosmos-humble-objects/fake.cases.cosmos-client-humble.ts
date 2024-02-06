import { CaseHistory } from '../adapters/types/case.history';
import { HumbleClient } from '../testing/mock.cosmos-client-humble';
import { TransferIn, TransferOut } from '../use-cases/orders/orders.model';

export default class FakeCasesCosmosClientHumble extends HumbleClient<
  TransferIn | TransferOut | CaseHistory
> {}
