import { ApplicationContext } from '../../adapters/types/basic';
import { CaseSyncEvent } from '@common/cams/dataflow-events';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CasesSyncState, LegacyCasesSyncState } from '../gateways.types';
import { randomUUID } from 'node:crypto';

const MODULE_NAME = 'SYNC-CASES-USE-CASE';

// Cursor of 0 means "fetch all terminal transactions" — safe starting point when AO_TX is empty.
function parseMaxTxId(raw: string | undefined): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

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

    // Bootstrap: derive starting TX_ID from date cursor on first run after deploy.
    // Once lastTransactionsTxId is stored in Cosmos it is used directly on all
    // subsequent runs.
    let lastTransactionsTxId: number;
    if (syncState.lastTransactionsTxId !== undefined) {
      // Coerce explicitly — mssql and Cosmos may round-trip large integers as strings.
      lastTransactionsTxId = Number.parseInt(String(syncState.lastTransactionsTxId), 10);
    } else {
      // bisectBound throws when it probes a TX_ID gap (deleted rows or identity gaps in
      // AO_TX). Catch and fall back to findMaxTransactionId so the bootstrap always
      // produces a valid cursor rather than propagating and silently stalling the sync.
      try {
        const range = await casesGateway.findTransactionIdRangeForDate(
          context,
          syncState.lastTransactionsSyncDate,
        );
        if (range.found && range.end !== undefined) {
          lastTransactionsTxId = range.end;
        } else {
          lastTransactionsTxId = parseMaxTxId(await casesGateway.findMaxTransactionId(context));
        }
      } catch (bisectError) {
        context.logger.warn(
          MODULE_NAME,
          'Bootstrap bisection encountered a TX_ID gap; falling back to max TX_ID',
          bisectError,
        );
        lastTransactionsTxId = parseMaxTxId(await casesGateway.findMaxTransactionId(context));
      }
    }

    const { caseIds, latestCasesSyncDate, latestTransactionsSyncDate, latestTransactionsTxId } =
      await casesGateway.getUpdatedCaseIds(
        context,
        syncState.lastCasesSyncDate,
        lastTransactionsTxId,
        syncState.lastTransactionsSyncDate,
      );

    const events: CaseSyncEvent[] = caseIds.map((caseId) => {
      return { type: 'CASE_CHANGED', caseId };
    });

    return {
      events,
      lastCasesSyncDate: latestCasesSyncDate,
      lastTransactionsSyncDate: latestTransactionsSyncDate,
      lastTransactionsTxId: latestTransactionsTxId,
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
