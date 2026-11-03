import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { CasesSyncState } from '../gateways.types';
import { getCamsError } from '../../common-errors/error-utilities';
import { isTransientInfraError } from '../../common-errors/transient-infra-error';

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
    if (isTransientInfraError(originalError)) {
      throw originalError;
    }
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      'Failed while storing the case sync runtime state.',
    );
    context.logger.camsError(error);
    throw error;
  }
}

const CasesRuntimeState = {
  storeRuntimeState,
};

export default CasesRuntimeState;
