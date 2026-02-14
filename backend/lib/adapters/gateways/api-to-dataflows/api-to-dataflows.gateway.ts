import { ApplicationContext } from '../../types/basic';
import { InvocationContextExtraOutputs, StorageQueueOutput } from '@azure/functions';
import { CASE_ASSIGNMENT_EVENT_QUEUE, SYNC_CASES_PAGE_QUEUE } from '../../../storage-queues';
import { CaseAssignmentEvent, CaseSyncEvent } from '@common/cams/dataflow-events';
import { ApiToDataflowsGateway } from '../../../use-cases/gateways.types';

export class ApiToDataflowsGatewayImpl implements ApiToDataflowsGateway {
  private context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  async queueCaseAssignmentEvent(event: CaseAssignmentEvent): Promise<void> {
    this.enqueue(CASE_ASSIGNMENT_EVENT_QUEUE, event);
  }

  async queueCaseReload(caseId: string): Promise<void> {
    const event: CaseSyncEvent = { caseId, type: 'CASE_CHANGED' };
    this.enqueue(SYNC_CASES_PAGE_QUEUE, event);
  }

  private enqueue(queue: StorageQueueOutput, ...messages: unknown[]): void {
    const output = this.context.extraOutputs as InvocationContextExtraOutputs | undefined;

    // No-op when extraOutputs unavailable (e.g., BDD tests running in Express)
    if (!output) {
      this.context.logger.warn(
        'API-TO-DATAFLOWS-GATEWAY',
        `Cannot enqueue to ${queue.queueName}: extraOutputs unavailable (likely running in Express/BDD context)`,
      );
      return;
    }

    output.set(queue, messages);
  }
}
