import { StorageQueueOutput } from '@azure/functions';
import { LogicalQueueNames } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';

import {
  CASE_ASSIGNMENT_EVENT,
  CASE_CLOSED_EVENT,
} from '../../../../function-apps/dataflows/storage-queues';

// Map logical queue names used by use cases to the Azure StorageQueueOutput to use.
const map = new Map<LogicalQueueNames, StorageQueueOutput>([
  ['CASE_ASSIGNMENT_EVENT', CASE_ASSIGNMENT_EVENT],
  ['CASE_CLOSED_EVENT', CASE_CLOSED_EVENT],
]);

async function add<T = unknown>(
  _context: ApplicationContext,
  queueName: LogicalQueueNames,
  _data: T,
) {
  // TODO: Need to add the ability to write the queue from the ApplicationContext.
  const _queue = map.get(queueName);
}

const StorageQueueGateway = {
  add,
};

export default StorageQueueGateway;
