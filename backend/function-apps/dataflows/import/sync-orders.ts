import { app, HttpRequest, InvocationContext, Timer } from '@azure/functions';

import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName, buildHttpTrigger } from '../dataflows-common';

const MODULE_NAME = 'SYNC-ORDERS';

async function timerTrigger(_ignore: Timer, invocationContext: InvocationContext): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  try {
    const ordersController = new OrdersController(context);
    await ordersController.handleTimer(context);
  } catch (error) {
    toAzureError(context.logger, MODULE_NAME, error);
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

const httpTrigger = buildHttpTrigger(
  MODULE_NAME,
  async (invocationContext: InvocationContext, request: HttpRequest) => {
    const context = await ContextCreator.getApplicationContext({
      invocationContext,
      request,
    });

    const ordersController = new OrdersController(context);
    return ordersController.handleRequest(context);
  },
);

function setup() {
  app.timer(buildFunctionName(MODULE_NAME, 'timerTrigger'), {
    handler: timerTrigger,
    schedule: '0 30 9 * * *',
  });

  app.http(buildFunctionName(MODULE_NAME, 'httpTrigger'), {
    handler: httpTrigger,
    methods: ['POST'],
    route: 'sync-orders',
  });
}

export default {
  MODULE_NAME,
  setup,
};
