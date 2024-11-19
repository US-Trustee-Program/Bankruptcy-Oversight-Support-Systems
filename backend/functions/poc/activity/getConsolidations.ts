import { InvocationContext } from '@azure/functions';
import { PredicateAndPage } from '../../lib/use-cases/acms-orders/acms-orders';
import ContextCreator from '../../azure/application-context-creator';
import AcmsOrdersController from '../../lib/controllers/acms-orders/acms-orders.controller';

async function getConsolidations(input: PredicateAndPage, invocationContext: InvocationContext) {
  // Do some stuff
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.applicationContextCreator(invocationContext, logger);
  const controller = new AcmsOrdersController();
  return controller.getConsolidationOrders(context, input);
}

export default {
  handler: getConsolidations,
};
