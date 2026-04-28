import { app, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { Trustee742MetricsController } from '../../../lib/controllers/trustee-742-metrics/trustee-742-metrics.controller';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName } from '../dataflows-common';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ModuleNames from '../module-names';

async function timerTrigger(_ignore: Timer, invocationContext: InvocationContext): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const controller = new Trustee742MetricsController();
    const metrics = await controller.handleTimer(context);
    completeDataflowTrace(
      context.observability,
      trace,
      ModuleNames.SYNC_TRUSTEE_742_METRICS,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: {
          trusteeListFetchCount: String(metrics.trusteeListFetchCount),
          nameEditsTotal: String(metrics.nameEditsTotal),
          nameEditsMigrated: String(metrics.nameEditsMigrated),
          nameEditsNonMigrated: String(metrics.nameEditsNonMigrated),
        },
      },
    );
  } catch (error) {
    completeDataflowTrace(
      context.observability,
      trace,
      ModuleNames.SYNC_TRUSTEE_742_METRICS,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    toAzureError(context.logger, ModuleNames.SYNC_TRUSTEE_742_METRICS, error);
  }
}

function setup() {
  app.timer(buildFunctionName(ModuleNames.SYNC_TRUSTEE_742_METRICS, 'timerTrigger'), {
    schedule: '0 0 6 * * *',
    handler: timerTrigger,
  });
}

export default {
  MODULE_NAME: ModuleNames.SYNC_TRUSTEE_742_METRICS,
  setup,
};
