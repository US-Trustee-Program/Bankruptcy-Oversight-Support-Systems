import { ApplicationContext } from '../../types/basic';
import { InvocationContextExtraOutputs, StorageQueueOutput } from '@azure/functions';
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
import { CamsError } from '../../../common-errors/cams-error';

const MODULE_NAME = 'API-TO-DATAFLOWS-GATEWAY';

export class ApiToDataflowsGatewayImpl implements ApiToDataflowsGateway {
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  async queueCaseAssignmentEvent(event: CaseAssignmentDownstreamEvent): Promise<void> {
    this.enqueue(CASE_ASSIGNMENT_EVENT_QUEUE, event);
  }

  async queueTrusteeAppointmentEvent(event: TrusteeAppointmentDownstreamEvent): Promise<void> {
    this.enqueue(TRUSTEE_APPOINTMENT_EVENT_QUEUE, event);
  }

  async queueCaseReload(caseId: string): Promise<void> {
    const event: CaseSyncEvent = { caseId, type: 'CASE_CHANGED' };
    this.enqueue(SYNC_CASES_PAGE_QUEUE, [event]);
  }

  async queueTrusteeVerificationRemap(message: TrusteeVerificationRemapMessage): Promise<void> {
    this.enqueue(TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE, message);
  }

  private enqueue(queue: StorageQueueOutput, message: unknown): void {
    const output = this.context.extraOutputs as InvocationContextExtraOutputs | undefined;

    // No-op when extraOutputs unavailable (e.g., BDD tests running in Express)
    if (!output) {
      this.context.logger.warn(
        MODULE_NAME,
        `Cannot enqueue to ${queue.queueName}: extraOutputs unavailable (likely running in Express/BDD context)`,
      );
      return;
    }

    // context.extraOutputs.set() never throws for a queue the invoking function's own
    // registration didn't declare in its extraOutputs array -- Azure Functions just never
    // serializes it, the silent-drop bug class this codebase has already hit twice (see
    // sync-trustee-case-appointments.ts's handlePage and trustee-verification-remap.ts's
    // handleRemap). registeredExtraOutputQueueNames lets us catch a regression here loudly
    // instead of a future function-app registration change silently dropping this write.
    // Undefined (not just an empty array) outside an Azure Functions invocation, where this
    // check cannot be performed -- do not fail Express/BDD contexts over a check they can't
    // satisfy.
    if (
      this.context.registeredExtraOutputQueueNames !== undefined &&
      !this.context.registeredExtraOutputQueueNames.includes(queue.queueName)
    ) {
      throw new CamsError(MODULE_NAME, {
        message: `Cannot enqueue to ${queue.queueName}: this function's own registration does not declare it in extraOutputs, so the write would be silently dropped by the Azure Functions runtime.`,
      });
    }

    // Azure Functions automatically unwraps one level of array nesting when sending to storage queues
    // Wrap the message in an array so it arrives intact: [message] -> message
    output.set(queue, [message]);
  }
}
