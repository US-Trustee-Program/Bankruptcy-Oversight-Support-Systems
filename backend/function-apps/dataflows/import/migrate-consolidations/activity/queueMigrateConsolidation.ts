import { InvocationContext } from '@azure/functions';
import {
  AcmsEtlQueueItem,
  AcmsPredicate,
} from '../../../../../lib/use-cases/dataflows/migrate-consolidations';
import ContextCreator from '../../../../azure/application-context-creator';
import AcmsOrdersController from '../../../../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../../../../lib/common-errors/error-utilities';
import { migrationQueue } from '../migrate-consolidations-constants';

const MODULE_NAME = 'IMPORT-ACTION-GET-CONSOLIDATIONS';

async function queueMigrateConsolidation(
  predicate: AcmsPredicate,
  invocationContext: InvocationContext,
) {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const controller = new AcmsOrdersController();

  try {
    const leadCaseIds = await controller.getLeadCaseIds(context, predicate);

    const queueItems = [];
    for (let i = 0; i < leadCaseIds.length; i++) {
      const leadCaseIdString = leadCaseIds[i].toString();
      const queueItem: AcmsEtlQueueItem = {
        divisionCode: predicate.divisionCode,
        chapter: predicate.chapter,
        leadCaseId: leadCaseIdString,
      };
      queueItems.push(queueItem);
    }
    logger.debug(MODULE_NAME, `Putting ${leadCaseIds.length} items in the queue.`, leadCaseIds);
    invocationContext.extraOutputs.set(migrationQueue, queueItems);
    return leadCaseIds;
  } catch (originalError) {
    const error = getCamsError(originalError, MODULE_NAME, 'Failed to get lead case ids.');
    logger.camsError(error);
    return [];
  }
}

export default queueMigrateConsolidation;
