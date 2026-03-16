import { app, InvocationContext } from '@azure/functions';
import ModuleNames from '../module-names';
import { CASE_DELETED_EVENT_DLQ, CASE_DELETED_EVENT_QUEUE } from '../../../lib/storage-queues';
import { buildFunctionName } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { archiveCaseAndRelatedDocuments } from '../../../lib/use-cases/dataflows/archive-case-documents';
import { CaseDeletedEvent } from '../../../lib/use-cases/dataflows/detect-deleted-cases';

const MODULE_NAME = ModuleNames.CASE_DELETED_EVENT;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

export async function archiveDeletedCaseHandler(
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
    invocationContext.extraOutputs.set(CASE_DELETED_EVENT_DLQ, { event, error });
  }
}

function setup() {
  app.storageQueue(HANDLER, {
    connection: CASE_DELETED_EVENT_QUEUE.connection,
    queueName: CASE_DELETED_EVENT_QUEUE.queueName,
    handler: archiveDeletedCaseHandler,
    extraOutputs: [CASE_DELETED_EVENT_DLQ],
  });
}

const CaseDeletedEvent = {
  MODULE_NAME,
  setup,
};

export default CaseDeletedEvent;
