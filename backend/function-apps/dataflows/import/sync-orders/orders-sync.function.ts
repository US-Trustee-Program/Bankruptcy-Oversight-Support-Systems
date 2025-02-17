import * as dotenv from 'dotenv';
import { app, InvocationContext, Timer } from '@azure/functions';
import { initializeApplicationInsights } from '../../../azure/app-insights';
import ContextCreator from '../../../azure/application-context-creator';
import { OrdersController } from '../../../../lib/controllers/orders/orders.controller';
import { toAzureError } from '../../../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ORDERS-SYNC-FUNCTION';

export default async function timerTrigger(
  _myTimer: Timer,
  invocationContext: InvocationContext,
): Promise<void> {
  const logger = ContextCreator.getLogger(invocationContext);
  try {
    const appContext = await ContextCreator.getApplicationContext({ invocationContext, logger });
    const ordersController = new OrdersController(appContext);
    await ordersController.handleTimer(appContext);
  } catch (error) {
    toAzureError(logger, MODULE_NAME, error);
  }
}

app.timer('orders-sync', {
  schedule: '0 30 9 * * *',
  handler: timerTrigger,
});
