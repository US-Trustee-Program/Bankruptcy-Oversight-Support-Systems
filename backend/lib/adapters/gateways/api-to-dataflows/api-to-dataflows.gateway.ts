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

// Memoized per queue name so StorageQueueHumbleObject's queueEnsured flag actually skips the
// redundant createIfNotExists round trip after the first send, matching the module-level
// singleton pattern in azure-blob-object-storage.gateway.ts. Keyed by connection string as
// well so a changed AzureWebJobsDataflowsStorage value (e.g. between test runs) doesn't reuse
// a client pointed at a stale endpoint.
const queueClients = new Map<string, StorageQueueHumbleObject>();

function getQueueClient(connectionString: string, queueName: string): StorageQueueHumbleObject {
  const key = `${connectionString}::${queueName}`;
  let client = queueClients.get(key);
  if (!client) {
    client = StorageQueueHumbleObject.fromConnectionString(connectionString, queueName);
    queueClients.set(key, client);
  }
  return client;
}

// Test-only escape hatch: clears the module-level client cache so each test can install a
// fresh StorageQueueHumbleObject.fromConnectionString spy without a prior test's cached
// client (and its mock) being reused.
export function __clearQueueClientCacheForTests(): void {
  queueClients.clear();
}

export class ApiToDataflowsGatewayImpl implements ApiToDataflowsGateway {
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

    const client = getQueueClient(connectionString, queue.queueName);
    await client.sendMessage(JSON.stringify(message));
  }
}
