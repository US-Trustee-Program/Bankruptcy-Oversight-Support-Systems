import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from '@azure/functions';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { buildFunctionName } from '../dataflows-common';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'SYNC_ORDERS';

export async function timerTrigger(
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

/**
 * Used to invoke the orders sync process between DXTR and CAMS CosmosDB from an accessable HTTP endpoint.
 *
 * This endpoint can be invoked from the CLI with the following cURL command. Modify the `txIdOverride` to a
 * specific AO_TX.TX_ID to start the sync from or omit it from the request body to use the last runtime state
 * stored in CosmosDB.
 *
 * curl -v -d '{"txIdOverride": "0"}' -H "Content-Type: application/json" http://localhost:7071/api/sync-orders
 *
 * @param {HttpRequest} request
 * @param {InvocationContext} invocationContext
 */
export async function httpTrigger(
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

export function setupSyncOrders() {
  app.timer(buildFunctionName(MODULE_NAME, 'timerTrigger'), {
    schedule: '0 30 9 * * *',
    handler: timerTrigger,
  });

  app.http(buildFunctionName(MODULE_NAME, 'httpTrigger'), {
    route: 'sync-orders',
    methods: ['POST'],
    handler: httpTrigger,
  });
}
