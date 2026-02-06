import { buildQueueName } from './dataflows-common';
import { output } from '@azure/functions';
import ModuleNames from './module-names';

export const STORAGE_QUEUE_CONNECTION = 'AzureWebJobsStorage';

const connection = STORAGE_QUEUE_CONNECTION;

export const CASE_ASSIGNMENT_EVENT_QUEUE = output.storageQueue({
  queueName: buildQueueName(ModuleNames.CASE_ASSIGNMENT_EVENT),
  connection,
});

export const CASE_ASSIGNMENT_EVENT_DLQ = output.storageQueue({
  queueName: buildQueueName(ModuleNames.CASE_ASSIGNMENT_EVENT, 'DLQ'),
  connection,
});

export const CASE_CLOSED_EVENT_QUEUE = output.storageQueue({
  queueName: buildQueueName(ModuleNames.CASE_CLOSED_EVENT),
  connection,
});

export const CASE_CLOSED_EVENT_DLQ = output.storageQueue({
  queueName: buildQueueName(ModuleNames.CASE_CLOSED_EVENT, 'DLQ'),
  connection,
});

export const SYNC_CASES_PAGE_QUEUE = output.storageQueue({
  queueName: buildQueueName(ModuleNames.SYNC_CASES_PAGE),
  connection,
});
