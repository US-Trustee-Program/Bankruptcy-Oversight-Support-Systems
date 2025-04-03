import { buildQueueName } from './dataflows-common';
import { output } from '@azure/functions';

export const SYNC_ASSIGNEES = 'SYNC-ASSIGNEES';
export const MIGRATE_ASSIGNEES = 'MIGRATE-ASSIGNEES';

export const STORAGE_QUEUE_CONNECTION = 'AzureWebJobsStorage';

const connection = STORAGE_QUEUE_CONNECTION;

// TODO: This should probably be defined ONLY in the migration source module.
export const MIGRATE_ASSIGNEES_START = output.storageQueue({
  queueName: buildQueueName(MIGRATE_ASSIGNEES, 'start'),
  connection,
});

export const CASE_CLOSED_EVENT = output.storageQueue({
  queueName: buildQueueName('CASE_CLOSED_EVENT'),
  connection,
});

export const CASE_ASSIGNMENT_EVENT = output.storageQueue({
  queueName: buildQueueName('CASE_ASSIGNMENT_EVENT'),
  connection,
});
