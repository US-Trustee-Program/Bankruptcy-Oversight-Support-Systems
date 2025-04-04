import { buildQueueName } from './dataflows-common';
import { output } from '@azure/functions';
import { CASE_ASSIGNMENT_EVENT } from './module-names';

export const STORAGE_QUEUE_CONNECTION = 'AzureWebJobsStorage';

const connection = STORAGE_QUEUE_CONNECTION;

export const CASE_CLOSED_EVENT = output.storageQueue({
  queueName: buildQueueName('CASE_CLOSED_EVENT'),
  connection,
});

export const CASE_ASSIGNMENT_EVENT_QUEUE = output.storageQueue({
  queueName: buildQueueName(CASE_ASSIGNMENT_EVENT),
  connection,
});

export const CASE_ASSIGNMENT_EVENT_DLQ = output.storageQueue({
  queueName: buildQueueName(CASE_ASSIGNMENT_EVENT, 'DLQ'),
  connection,
});
