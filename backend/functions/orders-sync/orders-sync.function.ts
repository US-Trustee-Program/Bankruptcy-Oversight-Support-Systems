import { app, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { toAzureError } from '../azure/functions';

import * as dotenv from 'dotenv';

// TODO: We need to look into upgrading this to use v4 of Azure Functions
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
    await ordersController.syncOrders(appContext);
  } catch (error) {
    toAzureError(logger, MODULE_NAME, error);
  }
}

app.timer('orders-sync', {
  schedule: '0 30 9 * * *',
  handler: timerTrigger,
});
