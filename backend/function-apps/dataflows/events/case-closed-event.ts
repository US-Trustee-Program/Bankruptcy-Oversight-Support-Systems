import { app, InvocationContext } from '@azure/functions';
import ModuleNames from '../module-names';
import { CASE_CLOSED_EVENT_DLQ, CASE_CLOSED_EVENT_QUEUE } from '../storage-queues';
import { buildFunctionName } from '../dataflows-common';
import { CaseAssignment } from '@common/cams/assignments';
import ContextCreator from '../../azure/application-context-creator';
import OfficeAssigneesUseCase from '../../../lib/use-cases/offices/office-assignees';

const MODULE_NAME = ModuleNames.CASE_CLOSED_EVENT;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

async function handler(event: CaseAssignment, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  try {
    await OfficeAssigneesUseCase.handleCaseClosedEvent(context, event);
  } catch (error) {
    invocationContext.extraOutputs.set(CASE_CLOSED_EVENT_DLQ, { event, error });
  }
}

function setup() {
  app.storageQueue(HANDLER, {
    connection: CASE_CLOSED_EVENT_QUEUE.connection,
    queueName: CASE_CLOSED_EVENT_QUEUE.queueName,
    handler,
    extraOutputs: [CASE_CLOSED_EVENT_DLQ],
  });
}

const CaseClosedEvent = {
  MODULE_NAME,
  setup,
};

export default CaseClosedEvent;
