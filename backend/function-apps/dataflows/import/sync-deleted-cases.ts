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

const MODULE_NAME = ModuleNames.SYNC_DELETED_CASES;
const DETECT_HANDLER = buildFunctionName(MODULE_NAME, 'detect-handler');
const ARCHIVE_HANDLER = buildFunctionName(MODULE_NAME, 'archive-handler');

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
  event: CaseDeletedEvent,
  invocationContext: InvocationContext,
) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  try {
    const summary = await archiveCaseAndRelatedDocuments(context, event.caseId);
    context.logger.info(
      MODULE_NAME,
      `Successfully archived case ${summary.caseId}: ${summary.archivedCount} documents archived with ${summary.errors.length} errors`,
    );
  } catch (error) {
    context.logger.error(MODULE_NAME, `Failed to archive case ${event.caseId}`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    invocationContext.extraOutputs.set(CASE_DELETED_EVENT_DLQ, {
      event,
      error: errorMessage,
      stack: errorStack,
    });
  }
}

function setup() {
  app.timer(DETECT_HANDLER, {
    schedule: '0 * * * * *',
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

export default SyncDeletedCases;
