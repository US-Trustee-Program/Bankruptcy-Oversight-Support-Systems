import { output } from '@azure/functions';

import { buildQueueName } from './dataflows-common';
import ModuleNames from './module-names';

export const STORAGE_QUEUE_CONNECTION = 'AzureWebJobsStorage';

const connection = STORAGE_QUEUE_CONNECTION;

export const CASE_ASSIGNMENT_EVENT_QUEUE = output.storageQueue({
  connection,
  queueName: buildQueueName(ModuleNames.CASE_ASSIGNMENT_EVENT),
});

export const CASE_ASSIGNMENT_EVENT_DLQ = output.storageQueue({
  connection,
  queueName: buildQueueName(ModuleNames.CASE_ASSIGNMENT_EVENT, 'DLQ'),
});

export const CASE_CLOSED_EVENT_QUEUE = output.storageQueue({
  connection,
  queueName: buildQueueName(ModuleNames.CASE_CLOSED_EVENT),
});

export const CASE_CLOSED_EVENT_DLQ = output.storageQueue({
  connection,
  queueName: buildQueueName(ModuleNames.CASE_CLOSED_EVENT, 'DLQ'),
});
