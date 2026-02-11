import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { CasesSyncState } from '../gateways.types';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'CASE-RUNTIME-STATE';

async function storeRuntimeState(
  context: ApplicationContext,
  lastCasesSyncDate: string,
  lastTransactionsSyncDate: string,
) {
  const runtimeStateRepo = factory.getCasesSyncStateRepo(context);
  try {
    const newSyncState: CasesSyncState = {
      documentType: 'CASES_SYNC_STATE',
      lastCasesSyncDate,
      lastTransactionsSyncDate,
    };
    await runtimeStateRepo.upsert(newSyncState);
    context.logger.info(MODULE_NAME, `Wrote runtime state: `, newSyncState);
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      'Failed while storing the case sync runtime state.',
    );
    context.logger.camsError(error);
  }
}

const CasesRuntimeState = {
  storeRuntimeState,
};

export default CasesRuntimeState;
