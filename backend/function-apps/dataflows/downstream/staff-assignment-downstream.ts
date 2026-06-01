import { app, InvocationContext } from '@azure/functions';
import ModuleNames from '../module-names';
import {
  CASE_ASSIGNMENT_EVENT_QUEUE,
  STAFF_ASSIGNMENT_DOWNSTREAM_DLQ,
} from '../../../lib/storage-queues';
import { buildFunctionName } from '../dataflows-common';
import { staffAssignmentHandler } from './acms-cams-transition';

const MODULE_NAME = ModuleNames.STAFF_ASSIGNMENT_DOWNSTREAM;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

async function handler(queueItem: unknown, invocationContext: InvocationContext): Promise<void> {
  await staffAssignmentHandler(queueItem, invocationContext, STAFF_ASSIGNMENT_DOWNSTREAM_DLQ);
}

function setup() {
  app.storageQueue(HANDLER, {
    connection: CASE_ASSIGNMENT_EVENT_QUEUE.connection,
    queueName: CASE_ASSIGNMENT_EVENT_QUEUE.queueName,
    handler,
    extraOutputs: [STAFF_ASSIGNMENT_DOWNSTREAM_DLQ],
  });
}

const StaffAssignmentDownstream = {
  MODULE_NAME,
  setup,
};

export default StaffAssignmentDownstream;
