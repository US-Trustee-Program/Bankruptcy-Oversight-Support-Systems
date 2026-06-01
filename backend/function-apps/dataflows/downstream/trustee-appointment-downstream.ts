import { app, InvocationContext } from '@azure/functions';
import ModuleNames from '../module-names';
import {
  TRUSTEE_APPOINTMENT_EVENT_QUEUE,
  TRUSTEE_APPOINTMENT_DOWNSTREAM_DLQ,
} from '../../../lib/storage-queues';
import { buildFunctionName } from '../dataflows-common';
import { trusteeAppointmentHandler } from './acms-cams-transition';

const MODULE_NAME = ModuleNames.TRUSTEE_APPOINTMENT_DOWNSTREAM;
const HANDLER = buildFunctionName(MODULE_NAME, 'handler');

async function handler(queueItem: unknown, invocationContext: InvocationContext): Promise<void> {
  await trusteeAppointmentHandler(queueItem, invocationContext, TRUSTEE_APPOINTMENT_DOWNSTREAM_DLQ);
}

function setup() {
  app.storageQueue(HANDLER, {
    connection: TRUSTEE_APPOINTMENT_EVENT_QUEUE.connection,
    queueName: TRUSTEE_APPOINTMENT_EVENT_QUEUE.queueName,
    handler,
    extraOutputs: [TRUSTEE_APPOINTMENT_DOWNSTREAM_DLQ],
  });
}

const TrusteeAppointmentDownstream = {
  MODULE_NAME,
  setup,
};

export default TrusteeAppointmentDownstream;
