import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';

dotenv.config();

initializeApplicationInsights();

/**
 * Used to invoke the orders sync process between DXTR and CAMS CosmosDB from an accessable HTTP endpoint.
 *
 * This endpoint can be invoked from the CLI with the following cURL command. Modify the `txIdOverride` to a
 * specific AO_TX.TX_ID to start the sync from or omit it from the request body to use the last runtime state
 * stored in CosmosDB.
 *
 * curl -v -d '{"txIdOverride": '0'}' -H "Content-Type: application/json" http://localhost:7071/api/orders-sync
 *
 * @param functionContext
 * @param request
 */
const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const context = await ContextCreator.applicationContextCreator(functionContext, request);

  const ordersController = new OrdersController(context);
  try {
    context.session = await ContextCreator.getApplicationContextSession(context);

    const results = await ordersController.syncOrders(context, request.body);
    functionContext.res = httpSuccess(results);
  } catch (camsError) {
    context.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
