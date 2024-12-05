import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { AcmsPredicateAndPage } from '../../lib/use-cases/acms-orders/acms-orders';
import AcmsOrdersController from '../../lib/controllers/acms-orders/acms-orders.controller';
import { getCamsError } from '../../lib/common-errors/error-utilities';

const MODULE_NAME = 'IMPORT-ACTION-GET-PAGE-COUNT';

async function getPageCount(input: AcmsPredicateAndPage, invocationContext: InvocationContext) {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const controller = new AcmsOrdersController();

  try {
    return await controller.getPageCount(context, input);
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}

export default {
  handler: getPageCount,
};
