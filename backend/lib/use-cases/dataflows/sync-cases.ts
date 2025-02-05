import { ApplicationContext } from '../../adapters/types/basic';
import { CaseSyncEvent } from './dataflow-types';
import Factory, { getCasesGateway } from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'SYNC-CASES-USE-CASE';

async function getCaseIds(context: ApplicationContext) {
  try {
    const runtimeStateRepo = Factory.getCasesSyncStateRepo(context);

    const syncState = await runtimeStateRepo.read('CASES_SYNC_STATE');
    if (!syncState) {
      // This should only happen until we run the migration.
      return { events: [] };
    }

    const casesGateway = getCasesGateway(context);
    const { caseIds, lastTxId } = await casesGateway.getCaseIdsAndMaxTxIdToSync(
      context,
      syncState.txId,
    );

    const events: CaseSyncEvent[] = caseIds.map((caseId) => {
      return { type: 'CASE_CHANGED', caseId };
    });
    return { events, lastTxId: lastTxId };
  } catch (originalError) {
    const error = getCamsError(originalError, MODULE_NAME);
    context.logger.camsError(error);
    return { events: [] };
  }
}

const SyncCases = {
  getCaseIds,
};

export default SyncCases;
