import { app, InvocationContext, Timer } from '@azure/functions';
import ModuleNames from '../module-names';
import { buildFunctionName } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import DetectDeletedCases from '../../../lib/use-cases/dataflows/detect-deleted-cases';
import { CASE_DELETED_EVENT_DLQ, CASE_DELETED_EVENT_QUEUE } from '../../../lib/storage-queues';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { toAzureError } from '../../azure/functions';
import { CaseDeletedEvent } from '../../../lib/use-cases/dataflows/detect-deleted-cases';
import { archiveCaseAndRelatedDocuments } from '../../../lib/use-cases/dataflows/archive-case-documents';
import { handleRateLimitRetry } from '../dataflows-rate-limit';

const MODULE_NAME = ModuleNames.SYNC_DELETED_CASES;
const DETECT_HANDLER = buildFunctionName(MODULE_NAME, 'detect-handler');
const ARCHIVE_HANDLER = buildFunctionName(MODULE_NAME, 'archive-handler');

type ArchiveMessage = CaseDeletedEvent & { retryCount?: number };

async function detectDeletedCasesTimer(_ignore: Timer, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const events = await DetectDeletedCases.getDeletedCaseEvents(context);

    invocationContext.extraOutputs.set(CASE_DELETED_EVENT_QUEUE, events);

    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'detectDeletedCasesTimer',
      context.logger,
      {
        documentsWritten: events.length,
        documentsFailed: 0,
        success: true,
        details: { eventCount: String(events.length) },
      },
    );
  } catch (error) {
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'detectDeletedCasesTimer',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    toAzureError(context.logger, MODULE_NAME, error);
    throw error;
  }
}

async function archiveDeletedCaseQueue(
  message: ArchiveMessage,
  invocationContext: InvocationContext,
) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    const summary = await archiveCaseAndRelatedDocuments(context, message.caseId);
    context.logger.info(
      MODULE_NAME,
      `Successfully archived case ${summary.caseId}: ${summary.archivedCount} documents archived with ${summary.errors.length} errors`,
    );
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'archiveDeletedCaseQueue',
      context.logger,
      {
        documentsWritten: summary.archivedCount,
        documentsFailed: summary.errors.length,
        success: true,
        details: { caseId: message.caseId },
      },
    );
  } catch (error) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: CASE_DELETED_EVENT_QUEUE.queueName,
      dlqOutput: CASE_DELETED_EVENT_DLQ,
      invocationContext,
      context,
      moduleName: MODULE_NAME,
      activityName: 'archiveDeletedCaseQueue',
      correlationId: message.caseId,
    });

    if (rateLimitRetryStatus === 'retried') {
      completeDataflowTrace(
        context.observability,
        trace,
        MODULE_NAME,
        'archiveDeletedCaseQueue',
        context.logger,
        {
          documentsWritten: 0,
          documentsFailed: 0,
          success: false,
          error: 'rate-limited-requeued',
        },
      );
      return;
    }

    if (rateLimitRetryStatus === 'exhausted') {
      completeDataflowTrace(
        context.observability,
        trace,
        MODULE_NAME,
        'archiveDeletedCaseQueue',
        context.logger,
        {
          documentsWritten: 0,
          documentsFailed: 1,
          success: false,
          error: 'rate-limit-retry-exhausted',
        },
      );
      return;
    }

    context.logger.error(MODULE_NAME, `Failed to archive case ${message.caseId}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    invocationContext.extraOutputs.set(CASE_DELETED_EVENT_DLQ, {
      event: message,
      error: errorMessage,
      stack: errorStack,
    });
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'archiveDeletedCaseQueue',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 1,
        success: false,
        error: errorMessage,
      },
    );
    throw error;
  }
}

function setup() {
  app.timer(DETECT_HANDLER, {
    schedule: '0 0 10 * * *',
    handler: detectDeletedCasesTimer,
    extraOutputs: [CASE_DELETED_EVENT_QUEUE],
  });

  app.storageQueue(ARCHIVE_HANDLER, {
    connection: CASE_DELETED_EVENT_QUEUE.connection,
    queueName: CASE_DELETED_EVENT_QUEUE.queueName,
    handler: archiveDeletedCaseQueue,
    extraOutputs: [CASE_DELETED_EVENT_DLQ],
  });
}

const SyncDeletedCases = {
  MODULE_NAME,
  setup,
};

export { archiveDeletedCaseQueue };
export default SyncDeletedCases;
