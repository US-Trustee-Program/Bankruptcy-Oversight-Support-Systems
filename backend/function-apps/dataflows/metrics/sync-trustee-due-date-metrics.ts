import { app, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeDueDateMetricsController } from '../../../lib/controllers/trustee-due-date-metrics/trustee-due-date-metrics.controller';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName } from '../dataflows-common';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';

const MODULE_NAME = 'SYNC-TRUSTEE-DUE-DATE-METRICS';

async function timerTrigger(_ignore: Timer, invocationContext: InvocationContext): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const controller = new TrusteeDueDateMetricsController();
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
        details: {
          totalChapter7Appointments: String(metrics.totalChapter7Appointments),
          completeCount: String(metrics.completeCount),
          partialCount: String(metrics.partialCount),
          noneCount: String(metrics.noneCount),
          completePercent: String(metrics.completePercent),
          partialPercent: String(metrics.partialPercent),
          nonePercent: String(metrics.nonePercent),
          tprReviewPeriodPercent: String(metrics.tprReviewPeriodPercent),
          pastFieldExamPercent: String(metrics.pastFieldExamPercent),
          pastIndependentAuditPercent: String(metrics.pastIndependentAuditPercent),
          tirReviewPeriodPercent: String(metrics.tirReviewPeriodPercent),
          tprDueDatePercent: String(metrics.tprDueDatePercent),
          upcomingFieldExamPercent: String(metrics.upcomingFieldExamPercent),
          upcomingIndependentAuditRequiredPercent: String(
            metrics.upcomingIndependentAuditRequiredPercent,
          ),
          tirSubmissionPercent: String(metrics.tirSubmissionPercent),
          tirReviewDueDatePercent: String(metrics.tirReviewDueDatePercent),
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
    schedule: '0 0 5 * * *',
    handler: timerTrigger,
  });
}

export default {
  MODULE_NAME,
  setup,
};
