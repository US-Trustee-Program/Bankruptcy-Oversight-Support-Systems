import { app, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeNotesMetricsController } from '../../../lib/controllers/trustee-notes-metrics/trustee-notes-metrics.controller';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName, buildHttpTrigger } from '../dataflows-common';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { isTooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';
import { TrusteeNoteMetrics } from '../../../lib/use-cases/dataflows/trustee-notes-metrics';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.SYNC_TRUSTEE_NOTES_METRICS;

function toMetricsDetails(metrics: TrusteeNoteMetrics): Record<string, string> {
  return {
    notesLast24Hrs: String(metrics.notesLast24Hrs),
    trusteesWithNotes: String(metrics.trusteesWithNotes),
    notesPerTrustee: JSON.stringify(metrics.notesPerTrustee),
    uniqueNoteAuthors: String(metrics.uniqueNoteAuthors),
    totalTrustees: String(metrics.totalTrustees),
    trusteesWithNotesPercent: String(metrics.trusteesWithNotesPercent),
    usersWithNotePermission: String(metrics.usersWithNotePermission),
    userEngagementPercent: String(metrics.userEngagementPercent),
  };
}

export async function timerTrigger(
  _ignore: Timer,
  invocationContext: InvocationContext,
): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const controller = new TrusteeNotesMetricsController();
    const metrics = await controller.handleTimer(context);
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: toMetricsDetails(metrics),
      },
    );
  } catch (error) {
    if (isTooManyRequestsError(error)) {
      context.logger.warn(
        MODULE_NAME,
        'Rate limited (429). Metrics run skipped; will retry on next timer tick.',
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

/**
 * Runs the same trustee notes metrics sync as the nightly timer, on demand, for
 * testing/ops use so we don't have to wait for the next scheduled tick.
 * curl -X POST -H "Authorization: ApiKey $ADMIN_KEY" http://localhost:7071/api/sync-trustee-notes-metrics
 */
export const httpTrigger = buildHttpTrigger(MODULE_NAME, async (invocationContext) => {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const controller = new TrusteeNotesMetricsController();
    const metrics = await controller.handleTimer(context);
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'httpTrigger',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: toMetricsDetails(metrics),
      },
    );
  } catch (error) {
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'httpTrigger',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    throw error;
  }
});

function setup() {
  app.timer(buildFunctionName(MODULE_NAME, 'timerTrigger'), {
    schedule: '0 0 5 * * *',
    handler: timerTrigger,
  });

  app.http(buildFunctionName(MODULE_NAME, 'httpTrigger'), {
    route: 'sync-trustee-notes-metrics',
    methods: ['POST'],
    handler: httpTrigger,
  });
}

export default {
  MODULE_NAME,
  setup,
};
