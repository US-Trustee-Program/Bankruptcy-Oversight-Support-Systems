import { app, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { OfficesController } from '../../../lib/controllers/offices/offices.controller';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName } from '../dataflows-common';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { isTooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';

const MODULE_NAME = 'SYNC-OFFICE-STAFF';

export async function timerTrigger(
  _ignore: Timer,
  invocationContext: InvocationContext,
): Promise<void> {
  const context = await ContextCreator.getApplicationContext({
    invocationContext,
  });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const controller = new OfficesController();
    const { success, fail } = await controller.handleTimer(context);
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: success,
        documentsFailed: fail,
        success: true,
      },
    );
  } catch (error) {
    if (isTooManyRequestsError(error)) {
      context.logger.warn(
        MODULE_NAME,
        'Rate limited (429). Run skipped; will retry on next timer tick.',
      );
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
          error: 'rate-limited',
        },
      );
      return;
    }
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
    schedule: '0 0 5 * * *',
    handler: timerTrigger,
  });
}

export default {
  MODULE_NAME,
  setup,
};
