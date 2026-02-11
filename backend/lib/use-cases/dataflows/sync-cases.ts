import { ApplicationContext } from '../../adapters/types/basic';
import { CaseSyncEvent } from '@common/queue/dataflow-types';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CasesSyncState, LegacyCasesSyncState } from '../gateways.types';
import { randomUUID } from 'node:crypto';

const MODULE_NAME = 'SYNC-CASES-USE-CASE';

function isLegacySyncState(
  state: CasesSyncState | LegacyCasesSyncState,
): state is LegacyCasesSyncState {
  return 'lastSyncDate' in state && !('lastCasesSyncDate' in state);
}

async function getCaseIds(context: ApplicationContext, lastSyncDate?: string) {
  try {
    let syncState: CasesSyncState;
    if (lastSyncDate) {
      syncState = {
        id: randomUUID(),
        documentType: 'CASES_SYNC_STATE',
        lastCasesSyncDate: lastSyncDate,
        lastTransactionsSyncDate: lastSyncDate,
      };
    } else {
      const runtimeStateRepo = factory.getCasesSyncStateRepo(context);
      const rawState = await runtimeStateRepo.read('CASES_SYNC_STATE');

      // Self-healing: Handle legacy single-date documents
      if (isLegacySyncState(rawState)) {
        syncState = {
          ...rawState,
          lastCasesSyncDate: rawState.lastSyncDate,
          lastTransactionsSyncDate: rawState.lastSyncDate,
        };
      } else {
        syncState = rawState;
      }
    }

    const casesGateway = factory.getCasesGateway(context);
    const { caseIds, latestCasesSyncDate, latestTransactionsSyncDate } =
      await casesGateway.getUpdatedCaseIds(
        context,
        syncState.lastCasesSyncDate,
        syncState.lastTransactionsSyncDate,
      );

    const events: CaseSyncEvent[] = caseIds.map((caseId) => {
      return { type: 'CASE_CHANGED', caseId };
    });

    return {
      events,
      lastCasesSyncDate: latestCasesSyncDate,
      lastTransactionsSyncDate: latestTransactionsSyncDate,
    };
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
