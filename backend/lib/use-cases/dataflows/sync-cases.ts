import { ApplicationContext } from '../../adapters/types/basic';
import { CaseSyncEvent } from '@common/queue/dataflow-types';
import Factory, { getCasesGateway } from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CasesSyncState } from '../gateways.types';
import { randomUUID } from 'node:crypto';

const MODULE_NAME = 'SYNC-CASES-USE-CASE';

async function getCaseIds(context: ApplicationContext, lastSyncDate?: string) {
  try {
    const now = new Date().toISOString();

    let syncState: CasesSyncState;
    if (lastSyncDate) {
      syncState = {
        id: randomUUID(),
        documentType: 'CASES_SYNC_STATE',
        lastSyncDate,
      };
    } else {
      const runtimeStateRepo = Factory.getCasesSyncStateRepo(context);
      syncState = await runtimeStateRepo.read('CASES_SYNC_STATE');
    }

    const casesGateway = getCasesGateway(context);
    const caseIds = await casesGateway.getUpdatedCaseIds(context, syncState.lastSyncDate);

    const events: CaseSyncEvent[] = caseIds.map((caseId) => {
      return { type: 'CASE_CHANGED', caseId };
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
