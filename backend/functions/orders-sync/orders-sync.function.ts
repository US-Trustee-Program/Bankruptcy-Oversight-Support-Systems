// TODO: The original context was InvocationContext
import { Context, Timer } from '@azure/functions';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';

import * as dotenv from 'dotenv';

// TODO: We need to look into upgrading this to use v4 of Azure Functions
dotenv.config();

initializeApplicationInsights();

export default async function timerTrigger(
  invocationContext: Context,
  timer: Timer,
): Promise<void> {
  const _timer2 = timer;
  const context = await applicationContextCreator(invocationContext);

  const ordersController = new OrdersController(context);
  try {
    await ordersController.syncOrders(context);
  } catch (camsError) {
    context.logger.camsError(camsError);
  }
}
