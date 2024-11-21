import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import AcmsOrdersController from '../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../lib/common-errors/error-utilities';

const MODULE_NAME = 'IMPORT_ACTION_MIGRATE_CONSOLIDATION';

async function migrateConsolidation(leadCaseId: string, invocationContext: InvocationContext) {
  const logger = ContextCreator.getLogger(invocationContext);
  const appContext = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const controller = new AcmsOrdersController();

  try {
    return controller.migrateConsolidation(appContext, leadCaseId);
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}

export default {
  handler: migrateConsolidation,
};
