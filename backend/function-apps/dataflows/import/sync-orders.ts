import { app, HttpRequest, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName, buildHttpTrigger } from '../dataflows-common';
import { startTrace, completeTrace } from '../../../lib/adapters/services/dataflow-observability';

const MODULE_NAME = 'SYNC-ORDERS';

async function timerTrigger(_ignore: Timer, invocationContext: InvocationContext): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = startTrace(
    MODULE_NAME,
    'timerTrigger',
    invocationContext.invocationId,
    context.logger,
  );
  try {
    const ordersController = new OrdersController(context);
    const status = await ordersController.handleTimer(context);
    completeTrace(trace, {
      documentsWritten: status.length,
      documentsFailed: 0,
      success: true,
    });
  } catch (error) {
    completeTrace(trace, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
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
    schedule: '0 30 9 * * *',
    handler: timerTrigger,
  });

  app.http(buildFunctionName(MODULE_NAME, 'httpTrigger'), {
    route: 'sync-orders',
    methods: ['POST'],
    handler: httpTrigger,
  });
}

export default {
  MODULE_NAME,
  setup,
};
