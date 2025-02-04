import { InvocationContext } from '@azure/functions';
import { CaseSyncEvent } from './import-dataflow-types';
import AcmsOrders from '../../../lib/use-cases/acms-orders/acms-orders';
import ContextCreator from '../../azure/application-context-creator';

// const MODULE_NAME = 'IMPORT-DATAFLOW-ACMS-ACTIVITIES';

/**
 * getCaseIdsToMigrate
 *
 * Export caseIds from ACMS to migrate from DXTR to CAMS.
 *
 * @returns {CaseSyncEvent[]}
 */
async function getCaseIdsToMigrate(
  _ignore: unknown,
  invocationContext: InvocationContext,
): Promise<CaseSyncEvent[]> {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const useCase = new AcmsOrders();
  try {
    const results = await useCase.getCaseIdsToMigrate(context);
    const events: CaseSyncEvent[] = results.map((caseId) => {
      return { type: 'MIGRATION', caseId };
    });
    return events;
  } catch (error) {
    context.logger.camsError(error);
    return [];
  }
}

const AcmsActivities = {
  getCaseIdsToMigrate,
};

export default AcmsActivities;
