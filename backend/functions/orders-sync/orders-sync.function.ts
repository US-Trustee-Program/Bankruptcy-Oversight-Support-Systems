// TODO: The original context was InvocationContext
import { app, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';

import * as dotenv from 'dotenv';

// TODO: We need to look into upgrading this to use v4 of Azure Functions
dotenv.config();

initializeApplicationInsights();

export default async function timerTrigger(
  myTimer: Timer,
  context: InvocationContext,
): Promise<void> {
  const appContext = await ContextCreator.applicationContextCreator(context, undefined);

  const ordersController = new OrdersController(appContext);
  try {
    await ordersController.syncOrders(appContext);
  } catch (camsError) {
    appContext.logger.camsError(camsError);
    myTimer.isPastDue;
  }
}
app.timer('timerTrigger', {
  schedule: '0 */5 * * * *',
  handler: timerTrigger,
});
