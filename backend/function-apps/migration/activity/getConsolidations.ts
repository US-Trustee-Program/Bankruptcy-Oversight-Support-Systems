import * as dotenv from 'dotenv';
import { InvocationContext, output } from '@azure/functions';
import {
  AcmsEtlQueueItem,
  AcmsPredicateAndPage,
} from '../../../lib/use-cases/acms-orders/acms-orders';
import ContextCreator from '../../azure/application-context-creator';
import AcmsOrdersController from '../../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../../lib/common-errors/error-utilities';

dotenv.config();

const MODULE_NAME = 'IMPORT_ACTION_GET_CONSOLIDATIONS';

const etlQueueOutput = output.storageQueue({
  queueName: process.env.CAMS_MIGRATION_TASK_QUEUE,
  connection: 'AzureWebJobs',
});

async function getConsolidations(
  predicateAndPage: AcmsPredicateAndPage,
  invocationContext: InvocationContext,
) {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const controller = new AcmsOrdersController();

  try {
    const leadCaseIds = await controller.getLeadCaseIds(context, predicateAndPage);

    const queueItems = [];
    for (let i = 0; i < leadCaseIds.length; i++) {
      const leadCaseIdString = leadCaseIds[i].toString();
      const queueItem: AcmsEtlQueueItem = {
        divisionCode: predicateAndPage.divisionCode,
        chapter: predicateAndPage.chapter,
        leadCaseId: leadCaseIdString,
      };
      queueItems.push(queueItem);
    }
    invocationContext.extraOutputs.set(etlQueueOutput, queueItems);

    return leadCaseIds;
  } catch (originalError) {
    const error = getCamsError(originalError, MODULE_NAME, 'Failed to get lead case ids.');
    logger.camsError(error);
    return [];
  }
}

export default getConsolidations;
