import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';

dotenv.config();

initializeApplicationInsights();

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  ordersRequest: HttpRequest,
): Promise<void> {
  const context = await applicationContextCreator(functionContext);

  const ordersController = new OrdersController(context);
  try {
    const results = await ordersController.syncOrders(context, ordersRequest.body);
    functionContext.res = httpSuccess(results);
  } catch (camsError) {
    context.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
