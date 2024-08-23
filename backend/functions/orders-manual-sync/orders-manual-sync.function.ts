import { InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { app } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { SyncOrdersOptions } from '../lib/use-cases/orders/orders';

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
 * @param invocationContext
 * @param request
 */
export async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator(invocationContext, request);

  const ordersController = new OrdersController(context);
  try {
    const results = await ordersController.syncOrders(context, request.body as SyncOrdersOptions);
    return { ...httpSuccess(results) };
  } catch (camsError) {
    context.logger.camsError(camsError);
    return { ...httpError(camsError) };
  }
}
app.http('handler', {
  methods: ['POST'],
  handler,
  route: 'orders-sync',
});

export default handler;
