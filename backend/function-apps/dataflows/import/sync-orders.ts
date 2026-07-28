import { app, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { OrdersController } from '../../../lib/controllers/orders/orders.controller';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName } from '@common/queues';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';

const MODULE_NAME = 'SYNC-ORDERS';

async function timerTrigger(_ignore: Timer, invocationContext: InvocationContext): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const ordersController = new OrdersController(context);
    const status = await ordersController.handleTimer(context);
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: status.length,
        documentsFailed: 0,
        success: true,
      },
    );
  } catch (error) {
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    toAzureError(context.logger, MODULE_NAME, error);
  }
}

function setup() {
  app.timer(buildFunctionName(MODULE_NAME, 'timerTrigger'), {
    schedule: '0 30 9 * * *',
    handler: timerTrigger,
  });
}

export default {
  MODULE_NAME,
  setup,
};
