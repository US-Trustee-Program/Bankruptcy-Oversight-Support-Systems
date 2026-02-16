import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { MaybeCaseSyncEvents } from './queue-types';

const MODULE_NAME = 'RESYNC-TERMINAL-TRANSACTION-CASES-USE-CASE';

/**
 * getCaseIdsWithBlindSpot
 *
 * Query DXTR for cases where terminal transactions exist but LAST_UPDATE_DATE wasn't updated.
 * Returns events ready for sync pipeline processing.
 */
async function getCaseIdsWithBlindSpot(
  context: ApplicationContext,
  cutoffDate: string = '2018-01-01',
): Promise<MaybeCaseSyncEvents> {
  try {
    const gateway = factory.getCasesGateway(context);
    const caseIds = await gateway.getCasesWithTerminalTransactionBlindSpot(context, cutoffDate);

    return {
      events: caseIds.map((caseId) => ({
        type: 'MIGRATION',
        caseId,
      })),
    };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to get case IDs with terminal transaction blind spot from DXTR.',
      ),
    };
  }
}

const ResyncTerminalTransactionCases = {
  getCaseIdsWithBlindSpot,
};

export default ResyncTerminalTransactionCases;
