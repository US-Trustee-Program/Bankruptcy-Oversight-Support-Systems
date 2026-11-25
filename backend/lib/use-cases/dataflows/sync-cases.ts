import { ApplicationContext } from '../../adapters/types/basic';
import { CaseSyncEvent } from '@common/cams/dataflow-events';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { isTransientInfraError } from '../../common-errors/transient-infra-error';
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
          id: rawState.id,
          documentType: rawState.documentType,
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
    if (isTransientInfraError(originalError)) {
      throw originalError;
    }
    const error = getCamsError(originalError, MODULE_NAME);
    context.logger.camsError(error);
    return { events: [] };
  }
}

/**
 * Reads the cases changed after fromDate, up to and including endDate.
 *
 * Unlike getCaseIds, every failure propagates. A caller that walks a range of windows has to stop
 * on an error; an empty result would be taken for a window with no changes and that window's
 * cases would never be synced.
 */
async function getCaseIdsInWindow(
  context: ApplicationContext,
  fromDate: string,
  endDate: string,
): Promise<{ events: CaseSyncEvent[] }> {
  const casesGateway = factory.getCasesGateway(context);
  const { caseIds } = await casesGateway.getUpdatedCaseIds(context, fromDate, fromDate, endDate);

  return {
    events: caseIds.map((caseId) => {
      return { type: 'CASE_CHANGED', caseId };
    }),
  };
}

const SyncCases = {
  getCaseIds,
  getCaseIdsInWindow,
};

export default SyncCases;
