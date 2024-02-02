import { CaseAssignmentHistory } from '../adapters/types/case.assignment';
import { HumbleClient } from '../testing/mock.cosmos-client-humble';
import { TransferIn, TransferOut } from '../use-cases/orders/orders.model';

export default class FakeCasesCosmosClientHumble extends HumbleClient<
  TransferIn | TransferOut | CaseAssignmentHistory
> {}
