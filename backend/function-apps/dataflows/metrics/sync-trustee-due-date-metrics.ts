import { app, InvocationContext, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeDueDateMetricsController } from '../../../lib/controllers/trustee-due-date-metrics/trustee-due-date-metrics.controller';
import { toAzureError } from '../../azure/functions';
import { buildFunctionName } from '../dataflows-common';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ModuleNames from '../module-names';
import { isTooManyRequestsError } from '../../../lib/common-errors/too-many-requests-error';

export async function timerTrigger(
  _ignore: Timer,
  invocationContext: InvocationContext,
): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const controller = new TrusteeDueDateMetricsController();
    const metrics = await controller.handleTimer(context);
    completeDataflowTrace(
      context.observability,
      trace,
      ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS,
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
          pastAuditPercent: String(metrics.pastAuditPercent),
          tirReviewPeriodPercent: String(metrics.tirReviewPeriodPercent),
          lastAuditFiscalYearPercent: String(metrics.lastAuditFiscalYearPercent),
          tirFrequencyPercent: String(metrics.tirFrequencyPercent),
          tprDueDatePercent: String(metrics.tprDueDatePercent),
          upcomingExamOrAuditYearPercent: String(metrics.upcomingExamOrAuditYearPercent),
          tirSubmissionPercent: String(metrics.tirSubmissionPercent),
          tirReviewDueDatePercent: String(metrics.tirReviewDueDatePercent),
        },
      },
    );
  } catch (error) {
    if (isTooManyRequestsError(error)) {
      context.logger.warn(
        ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS,
        'Rate limited (429). Metrics run skipped; will retry on next timer tick.',
      );
      completeDataflowTrace(
        context.observability,
        trace,
        ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS,
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
      ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS,
      'timerTrigger',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    toAzureError(context.logger, ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS, error);
  }
}

function setup() {
  app.timer(buildFunctionName(ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS, 'timerTrigger'), {
    schedule: '0 0 5 * * *',
    handler: timerTrigger,
  });
}

export default {
  MODULE_NAME: ModuleNames.SYNC_TRUSTEE_DUE_DATE_METRICS,
  setup,
};
