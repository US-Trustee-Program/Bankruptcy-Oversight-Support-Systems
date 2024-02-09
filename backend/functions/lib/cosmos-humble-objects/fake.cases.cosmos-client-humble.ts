import { CaseHistory } from '../adapters/types/case.history';
import { HumbleClient } from '../testing/mock.cosmos-client-humble';
import { TransferIn, TransferOut } from '../../../../common/src/cams/events';

export default class FakeCasesCosmosClientHumble extends HumbleClient<
  TransferIn | TransferOut | CaseHistory
> {}
