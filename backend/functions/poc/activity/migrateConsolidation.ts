import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { AcmsConsolidation } from '../../lib/use-cases/acms-orders/acms-orders';
import AcmsOrdersController from '../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../lib/common-errors/error-utilities';

const MODULE_NAME = 'IMPORT_ACTION_MIGRATE_CONSOLIDATION';

async function migrateConsolidation(
  input: AcmsConsolidation,
  invocationContext: InvocationContext,
) {
  const logger = ContextCreator.getLogger(invocationContext);
  const appContext = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const controller = new AcmsOrdersController();

  try {
    return controller.migrateConsolidation(appContext, input);
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}

export default {
  handler: migrateConsolidation,
};
