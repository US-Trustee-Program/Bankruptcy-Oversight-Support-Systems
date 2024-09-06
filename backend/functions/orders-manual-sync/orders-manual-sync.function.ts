import * as dotenv from 'dotenv';
import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { toAzureError, toAzureSuccess } from '../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ORDERS-MANUAL-SYNC-FUNCTION';

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
export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({
    invocationContext,
    logger,
    request,
  });

  const ordersController = new OrdersController(context);
  try {
    const results = await ordersController.handleRequest(context);
    return toAzureSuccess(results);
  } catch (error) {
    return toAzureError(context, MODULE_NAME, error);
  }
}

app.http('order-manual-sync', {
  methods: ['POST'],
  handler,
  route: 'orders-sync',
});
