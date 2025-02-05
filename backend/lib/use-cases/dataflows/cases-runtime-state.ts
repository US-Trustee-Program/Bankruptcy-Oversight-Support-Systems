import { ApplicationContext } from '../../adapters/types/basic';
import Factory, { getCasesGateway } from '../../factory';
import { UnknownError } from '../../common-errors/unknown-error';
import { CasesSyncState } from '../gateways.types';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'CASE-RUNTIME-STATE';

async function storeRuntimeState(context: ApplicationContext, lastTxId?: string) {
  const runtimeStateRepo = Factory.getCasesSyncStateRepo(context);
  try {
    const syncState = await runtimeStateRepo.read('CASES_SYNC_STATE');
    if (!lastTxId) {
      const gateway = getCasesGateway(context);
      lastTxId = await gateway.findMaxTransactionId(context);
      if (!lastTxId) {
        throw new UnknownError(MODULE_NAME, {
          message: 'Failed to determine the maximum transaction id.',
        });
      }
    }
    if (!syncState || lastTxId > syncState.txId) {
      const newSyncState: CasesSyncState = {
        ...syncState,
        documentType: 'CASES_SYNC_STATE',
        txId: lastTxId,
      };
      await runtimeStateRepo.upsert(newSyncState);
    }
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed while storing the case sync runtime state.`,
    );
    context.logger.camsError(error);
  }
}

const CasesRuntimeState = {
  storeRuntimeState,
};

export default CasesRuntimeState;
