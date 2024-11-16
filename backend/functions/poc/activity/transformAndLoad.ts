import { InvocationContext } from '@azure/functions';
import { AcmsConsolidation } from '../model';
import ContextCreator from '../../azure/application-context-creator';
import { OrdersController } from '../../lib/controllers/orders/orders.controller';

async function transformAndLoad(input: AcmsConsolidation, invocationContext: InvocationContext) {
  // Do some stuff
  const logger = ContextCreator.getLogger(invocationContext);
  const appContext = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const controller = new OrdersController(appContext);
  return controller.handleMigration(appContext, input);
}

export default {
  handler: transformAndLoad,
};
