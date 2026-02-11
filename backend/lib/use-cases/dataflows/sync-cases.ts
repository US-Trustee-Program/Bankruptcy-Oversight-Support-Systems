import { ApplicationContext } from '../../adapters/types/basic';
import { CaseSyncEvent } from '@common/queue/dataflow-types';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CasesSyncState } from '../gateways.types';
import { randomUUID } from 'node:crypto';

const MODULE_NAME = 'SYNC-CASES-USE-CASE';

async function getCaseIds(context: ApplicationContext, lastSyncDate?: string) {
  try {
    let syncState: CasesSyncState;
    if (lastSyncDate) {
      syncState = {
        id: randomUUID(),
        documentType: 'CASES_SYNC_STATE',
        lastSyncDate,
      };
    } else {
      const runtimeStateRepo = factory.getCasesSyncStateRepo(context);
      syncState = await runtimeStateRepo.read('CASES_SYNC_STATE');
    }

    const casesGateway = factory.getCasesGateway(context);
    const { caseIds, latestSyncDate } = await casesGateway.getUpdatedCaseIds(
      context,
      syncState.lastSyncDate,
    );

    const events: CaseSyncEvent[] = caseIds.map((caseId) => {
      return { type: 'CASE_CHANGED', caseId };
    });

    return { events, lastSyncDate: latestSyncDate };
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
