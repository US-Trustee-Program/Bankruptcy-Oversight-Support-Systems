import { randomUUID } from 'node:crypto';

import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import Factory, { getCasesGateway } from '../../factory';
import { CasesSyncState } from '../gateways.types';

const MODULE_NAME = 'SYNC-CASES-USE-CASE';

async function getCaseIds(context: ApplicationContext, lastSyncDate?: string) {
  try {
    const now = new Date().toISOString();

    let syncState: CasesSyncState;
    if (lastSyncDate) {
      syncState = {
        documentType: 'CASES_SYNC_STATE',
        id: randomUUID(),
        lastSyncDate,
      };
    } else {
      const runtimeStateRepo = Factory.getCasesSyncStateRepo(context);
      syncState = await runtimeStateRepo.read('CASES_SYNC_STATE');
    }

    const casesGateway = getCasesGateway(context);
    const caseIds = await casesGateway.getUpdatedCaseIds(context, syncState.lastSyncDate);

    const events: CaseSyncEvent[] = caseIds.map((caseId) => {
      return { caseId, type: 'CASE_CHANGED' };
    });

    return { events, lastSyncDate: now };
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
