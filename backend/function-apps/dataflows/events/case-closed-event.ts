import { app, InvocationContext } from '@azure/functions';

import { CaseAssignment } from '../../../../common/src/cams/assignments';
import OfficeAssigneesUseCase from '../../../lib/use-cases/offices/office-assignees';
import ContextCreator from '../../azure/application-context-creator';
import { buildFunctionName } from '../dataflows-common';
import ModuleNames from '../module-names';
import { CASE_CLOSED_EVENT_DLQ, CASE_CLOSED_EVENT_QUEUE } from '../storage-queues';

const MODULE_NAME = ModuleNames.CASE_CLOSED_EVENT;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

async function handler(event: CaseAssignment, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  try {
    await OfficeAssigneesUseCase.handleCaseClosedEvent(context, event);
  } catch (error) {
    invocationContext.extraOutputs.set(CASE_CLOSED_EVENT_DLQ, { error, event });
  }
}

function setup() {
  app.storageQueue(HANDLER, {
    connection: CASE_CLOSED_EVENT_QUEUE.connection,
    extraOutputs: [CASE_CLOSED_EVENT_DLQ],
    handler,
    queueName: CASE_CLOSED_EVENT_QUEUE.queueName,
  });
}

const CaseClosedEvent = {
  MODULE_NAME,
  setup,
};

export default CaseClosedEvent;
