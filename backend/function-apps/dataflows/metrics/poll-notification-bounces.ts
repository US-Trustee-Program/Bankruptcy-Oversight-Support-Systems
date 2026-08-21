import { app, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName } from '../dataflows-common';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { BouncePollUseCase } from '../../../lib/use-cases/notifications/bounce-poll';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.POLL_NOTIFICATION_BOUNCES;

export async function timerTrigger(
  _ignore: Timer,
  invocationContext: InvocationContext,
): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const useCase = new BouncePollUseCase(context);
    const summary = await useCase.pollAndReconstruct(context);
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: summary.reconstructed,
        documentsFailed: summary.failed,
        success: summary.failed === 0,
        details: {
          bouncesFound: String(summary.found),
          bouncesExpired: String(summary.expired),
        },
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
    // Every 15 minutes, matching the acsBounceAlert rule's evaluation window.
    schedule: '0 */15 * * * *',
    handler: timerTrigger,
  });
}

export default {
  MODULE_NAME,
  setup,
};
