import { InvocationContext, output } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import AcmsOrdersController from '../../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { isAcmsEtlQueueItem } from '../../../lib/use-cases/acms-orders/acms-orders';

const MODULE_NAME = 'IMPORT_ACTION_MIGRATE_CONSOLIDATION';

const successQueue = output.storageQueue({
  queueName: 'migration-task-success',
  connection: 'AzureWebJobs',
});

const failQueue = output.storageQueue({
  queueName: 'migration-task-fail',
  connection: 'AzureWebJobs',
});

async function migrateConsolidation(message: unknown, context: InvocationContext) {
  const logger = ContextCreator.getLogger(context);
  const appContext = await ContextCreator.getApplicationContext({
    invocationContext: context,
    logger,
  });
  const controller = new AcmsOrdersController();

  try {
    const maybeQueueItem =
      typeof message === 'object'
        ? message
        : typeof message === 'string'
          ? JSON.parse(message)
          : {};

    if (!isAcmsEtlQueueItem(maybeQueueItem)) {
      throw new CamsError(MODULE_NAME, { message: 'Invalid ACMS migration ETL queue entry.' });
    }
    const { leadCaseId } = maybeQueueItem;
    const result = await controller.migrateConsolidation(appContext, leadCaseId);

    const destinationQueue = result.success ? successQueue : failQueue;
    context.extraOutputs.set(destinationQueue, [result]);
  } catch (originalError) {
    const errorMessage = {
      message,
      error: getCamsError(originalError, MODULE_NAME),
    };
    context.extraOutputs.set(successQueue, [errorMessage]);
  }
}

export default migrateConsolidation;
