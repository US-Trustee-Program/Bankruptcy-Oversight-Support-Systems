import { ApplicationContext } from '../../adapters/types/basic';
import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';
import Factory, { getCasesGateway } from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CasesSyncState } from '../gateways.types';
import { randomUUID } from 'node:crypto';

const MODULE_NAME = 'SYNC-CASES-USE-CASE';

async function getCaseIds(context: ApplicationContext, lastRunTxId?: string) {
  try {
    const runtimeStateRepo = Factory.getCasesSyncStateRepo(context);

    let syncState: CasesSyncState;
    if (lastRunTxId) {
      syncState = {
        id: randomUUID(),
        documentType: 'CASES_SYNC_STATE',
        txId: lastRunTxId,
      };
    } else {
      syncState = await runtimeStateRepo.read('CASES_SYNC_STATE');
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
