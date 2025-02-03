import { InvocationContext } from '@azure/functions';
import { CaseSyncEvent } from './import-dataflow-types';
import DataflowsCommon from '../dataflows-common';
import AcmsOrders from '../../../lib/use-cases/acms-orders/acms-orders';

// const MODULE_NAME = 'IMPORT-DATAFLOW-ACMS-ACTIVITIES';

/**
 * getCaseIdsToMigrate
 *
 * Export caseIds from ACMS to migrate from DXTR to CAMS.
 *
 * @returns {CaseSyncEvent[]}
 */
async function getCaseIdsToMigrate(
  _: unknown,
  invocationContext: InvocationContext,
): Promise<CaseSyncEvent[]> {
  const context = await DataflowsCommon.getApplicationContext(invocationContext);
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
