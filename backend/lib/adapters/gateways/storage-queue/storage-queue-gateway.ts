import { InvocationContextExtraOutputs, StorageQueueOutput } from '@azure/functions';
import { LogicalQueueNames, QueueGateway } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';

import {
  CASE_ASSIGNMENT_EVENT_QUEUE,
  CASE_CLOSED_EVENT_QUEUE,
  SYNC_CASES_PAGE_QUEUE,
} from '../../../../function-apps/dataflows/storage-queues';

// Map logical queue names used by use cases to the Azure StorageQueueOutput to use.
const map = new Map<LogicalQueueNames, StorageQueueOutput>([
  ['CASE_ASSIGNMENT_EVENT', CASE_ASSIGNMENT_EVENT_QUEUE],
  ['CASE_CLOSED_EVENT', CASE_CLOSED_EVENT_QUEUE],
  ['SYNC_CASES_PAGE', SYNC_CASES_PAGE_QUEUE],
]);

function using<T = unknown>(context: ApplicationContext, queueName: LogicalQueueNames) {
  const output = context.extraOutputs as InvocationContextExtraOutputs;
  const queue = map.get(queueName);

  const enqueue = (...messages: (T | T[])[]) => {
    // Azure storage queue output binding unwraps arrays and sends each element
    // as a separate message. Callers can pass individual events or arrays of events.
    // - Individual events: enqueue(event1, event2) -> sends 2 messages
    // - Array of events: enqueue([event1, event2]) -> sends 1 message with array payload
    output.set(queue, messages);
  };

  return {
    enqueue,
  };
}

const StorageQueueGateway: QueueGateway = {
  using,
};

export default StorageQueueGateway;
