import { app, HttpRequest, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName, buildHttpTrigger } from '../dataflows-common';

const MODULE_NAME = 'SYNC_ORDERS';

export async function timerTrigger(
  _ignore: Timer,
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
 */

export const httpTrigger = buildHttpTrigger(
  MODULE_NAME,
  async (invocationContext: InvocationContext, request: HttpRequest) => {
    const logger = ContextCreator.getLogger(invocationContext);
    const context = await ContextCreator.getApplicationContext({
      invocationContext,
      logger,
      request,
    });

    const ordersController = new OrdersController(context);
    return ordersController.handleRequest(context);
  },
);

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
