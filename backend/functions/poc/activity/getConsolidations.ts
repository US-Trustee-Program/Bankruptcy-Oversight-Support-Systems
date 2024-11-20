import { InvocationContext } from '@azure/functions';
import { PredicateAndPage } from '../../lib/use-cases/acms-orders/acms-orders';
import ContextCreator from '../../azure/application-context-creator';
import AcmsOrdersController from '../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../lib/common-errors/error-utilities';

const MODULE_NAME = 'IMPORT_ACTION_GET_CONSOLIDATIONS';

async function getConsolidations(input: PredicateAndPage, invocationContext: InvocationContext) {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.applicationContextCreator(invocationContext, logger);
  const controller = new AcmsOrdersController();

  try {
    return controller.getConsolidations(context, input);
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}

export default {
  handler: getConsolidations,
};
