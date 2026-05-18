import { app, InvocationContext } from '@azure/functions';
import ModuleNames from '../module-names';
import {
  CASE_ASSIGNMENT_EVENT_DLQ,
  CASE_ASSIGNMENT_EVENT_QUEUE,
  CASE_ASSIGNMENT_EVENT_RETRY,
} from '../../../lib/storage-queues';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import { CaseAssignment } from '@common/cams/assignments';
import ContextCreator from '../../azure/application-context-creator';
import OfficeAssigneesUseCase from '../../../lib/use-cases/offices/office-assignees';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { handleRateLimitRetry } from '../dataflows-rate-limit';

const MODULE_NAME = ModuleNames.CASE_ASSIGNMENT_EVENT;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

type CaseAssignmentMessage = CaseAssignment & { retryCount?: number };

async function handler(message: CaseAssignmentMessage, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  try {
    await OfficeAssigneesUseCase.handleCaseAssignmentEvent(context, message);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handler', context.logger, {
      documentsWritten: 1,
      documentsFailed: 0,
      success: true,
    });
  } catch (error) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: buildQueueName(MODULE_NAME, 'retry'),
      dlqOutput: CASE_ASSIGNMENT_EVENT_DLQ,
      invocationContext,
      context,
      moduleName: MODULE_NAME,
      activityName: 'handler',
    });

    if (rateLimitRetryStatus !== 'not-rate-limited') {
      return;
    }

    invocationContext.extraOutputs.set(CASE_ASSIGNMENT_EVENT_DLQ, { event: message, error });
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handler', context.logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function setup() {
  app.storageQueue(HANDLER, {
    connection: CASE_ASSIGNMENT_EVENT_QUEUE.connection,
    queueName: CASE_ASSIGNMENT_EVENT_QUEUE.queueName,
    handler,
    extraOutputs: [CASE_ASSIGNMENT_EVENT_DLQ, CASE_ASSIGNMENT_EVENT_RETRY],
  });
}

const CaseAssignmentEvent = {
  MODULE_NAME,
  setup,
};

export { handler };
export default CaseAssignmentEvent;
