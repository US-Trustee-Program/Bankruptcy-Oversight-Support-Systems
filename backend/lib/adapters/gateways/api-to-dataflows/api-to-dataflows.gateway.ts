import { ApplicationContext } from '../../types/basic';
import { StorageQueueOutput } from '@azure/functions';
import {
  CASE_ASSIGNMENT_EVENT_QUEUE,
  SYNC_CASES_PAGE_QUEUE,
  TRUSTEE_APPOINTMENT_EVENT_QUEUE,
  TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE,
} from '../../../storage-queues';
import {
  CaseAssignmentDownstreamEvent,
  CaseSyncEvent,
  TrusteeAppointmentDownstreamEvent,
  TrusteeVerificationRemapMessage,
} from '@common/cams/dataflow-events';
import { ApiToDataflowsGateway } from '../../../use-cases/gateways.types';
import { StorageQueueHumbleObject } from '../../../humble-objects/storage-queue-humble';

export class ApiToDataflowsGatewayImpl implements ApiToDataflowsGateway {
  // Unused internally now that enqueue() throws instead of logging via context.logger, but
  // kept as a constructor parameter to match factory.getApiToDataflowsGateway's call
  // signature and the constructor-injection convention every other gateway follows.
  constructor(private readonly context: ApplicationContext) {}

  async queueCaseAssignmentEvent(event: CaseAssignmentDownstreamEvent): Promise<void> {
    await this.enqueue(CASE_ASSIGNMENT_EVENT_QUEUE, event);
  }

  async queueTrusteeAppointmentEvent(event: TrusteeAppointmentDownstreamEvent): Promise<void> {
    await this.enqueue(TRUSTEE_APPOINTMENT_EVENT_QUEUE, event);
  }

  async queueCaseReload(caseId: string): Promise<void> {
    const event: CaseSyncEvent = { caseId, type: 'CASE_CHANGED' };
    await this.enqueue(SYNC_CASES_PAGE_QUEUE, [event]);
  }

  async queueTrusteeVerificationRemap(message: TrusteeVerificationRemapMessage): Promise<void> {
    await this.enqueue(TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE, message);
  }

  private async enqueue(queue: StorageQueueOutput, message: unknown): Promise<void> {
    const connectionString = process.env.AzureWebJobsDataflowsStorage;
    if (!connectionString) {
      throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
    }

    const client = StorageQueueHumbleObject.fromConnectionString(connectionString, queue.queueName);
    await client.sendMessage(JSON.stringify(message));
  }
}
