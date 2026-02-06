import { app, InvocationContext } from '@azure/functions';
import ModuleNames from '../module-names';
import {
  CASE_ASSIGNMENT_EVENT_DLQ,
  CASE_ASSIGNMENT_EVENT_QUEUE,
} from '../../../lib/storage-queues';
import { buildFunctionName } from '../dataflows-common';
import { CaseAssignment } from '@common/cams/assignments';
import ContextCreator from '../../azure/application-context-creator';
import OfficeAssigneesUseCase from '../../../lib/use-cases/offices/office-assignees';

const MODULE_NAME = ModuleNames.CASE_ASSIGNMENT_EVENT;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

async function handler(event: CaseAssignment, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  try {
    await OfficeAssigneesUseCase.handleCaseAssignmentEvent(context, event);
  } catch (error) {
    invocationContext.extraOutputs.set(CASE_ASSIGNMENT_EVENT_DLQ, { event, error });
  }
}

function setup() {
  app.storageQueue(HANDLER, {
    connection: CASE_ASSIGNMENT_EVENT_QUEUE.connection,
    queueName: CASE_ASSIGNMENT_EVENT_QUEUE.queueName,
    handler,
    extraOutputs: [CASE_ASSIGNMENT_EVENT_DLQ],
  });
}

const CaseAssignmentEvent = {
  MODULE_NAME,
  setup,
};

export default CaseAssignmentEvent;
