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

/**
 * Creates a fluent API for enqueuing messages to Azure Storage Queues.
 *
 * @template T - The type of message to enqueue
 * @param context - The application context containing Azure function outputs
 * @param queueName - The logical queue name (mapped to physical Azure queue)
 * @returns An object with an `enqueue` method
 *
 * @example
 * ```typescript
 * // Enqueue individual messages
 * const queue = StorageQueueGateway.using(context, 'CASE_ASSIGNMENT_EVENT');
 * queue.enqueue(event1, event2); // Sends 2 separate messages
 *
 * // Enqueue array as single message
 * queue.enqueue([event1, event2]); // Sends 1 message with array payload
 * ```
 */
function using<T = unknown>(context: ApplicationContext, queueName: LogicalQueueNames) {
  const output = context.extraOutputs as InvocationContextExtraOutputs;
  const queue = map.get(queueName);

  /**
   * Enqueues one or more messages to the Azure Storage Queue.
   *
   * Azure storage queue output binding unwraps arrays and sends each element
   * as a separate message. Callers can pass individual events or arrays of events.
   *
   * @param messages - Individual messages or arrays of messages to enqueue
   *
   * @example
   * ```typescript
   * // Individual events: sends 2 messages
   * enqueue(event1, event2);
   *
   * // Array of events: sends 1 message with array payload
   * enqueue([event1, event2]);
   * ```
   */
  const enqueue = (...messages: (T | T[])[]) => {
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
