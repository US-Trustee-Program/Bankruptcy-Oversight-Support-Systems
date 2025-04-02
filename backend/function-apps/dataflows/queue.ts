import { buildQueueName } from './dataflows-common';
import { output } from '@azure/functions';

export const SYNC_ASSIGNEES = 'SYNC-ASSIGNEES';
export const MIGRATE_ASSIGNEES = 'MIGRATE-ASSIGNEES';

export const STORAGE_QUEUE_CONNECTION = 'AzureWebJobsStorage';

// Yeah. Funny eh?
const connection = STORAGE_QUEUE_CONNECTION;

export const MIGRATE_ASSIGNEES_START = output.storageQueue({
  queueName: buildQueueName(MIGRATE_ASSIGNEES, 'start'),
  connection,
});
