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

const MODULE_NAME = 'API-TO-DATAFLOWS-GATEWAY';

export class ApiToDataflowsGatewayImpl implements ApiToDataflowsGateway {
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

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
    // Absent in BDD (plain Express, no Azure Functions host) and E2E (local.settings.backend.json
    // only configures AzureWebJobsStorage, not this Dataflows-specific connection string) --
    // no-op rather than throw, since neither environment provisions a queue to send to.
    const connectionString = process.env.AzureWebJobsDataflowsStorage;
    if (!connectionString) {
      this.context.logger.warn(
        MODULE_NAME,
        `Cannot enqueue to ${queue.queueName}: AzureWebJobsDataflowsStorage is not configured.`,
      );
      return;
    }

    const client = StorageQueueHumbleObject.fromConnectionString(connectionString, queue.queueName);
    await client.sendMessage(JSON.stringify(message));
  }
}
