import { app, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import ModuleNames from './module-names';
import { buildFunctionName } from './dataflows-common';
import {
  HEAL_SENTINEL_CASE_APPOINTMENTS_QUEUE,
  HEAL_SENTINEL_CASE_APPOINTMENTS_DLQ,
} from '../../lib/storage-queues';
import { completeDataflowTrace } from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { handleRateLimitRetry } from './dataflows-rate-limit';
import HealSentinelCaseAppointmentsUseCase from '../../lib/use-cases/dataflows/heal-sentinel-case-appointments';
import { HealSentinelCaseAppointmentsMessage } from '@common/cams/dataflow-events';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';

const MODULE_NAME = ModuleNames.HEAL_SENTINEL_CASE_APPOINTMENTS;
const HANDLE_HEAL = buildFunctionName(MODULE_NAME, 'handleHeal');

const HEAL = HEAL_SENTINEL_CASE_APPOINTMENTS_QUEUE;
const DLQ = HEAL_SENTINEL_CASE_APPOINTMENTS_DLQ;

// Bounds how many sentinel appointments a single invocation heals serially, so an unexpectedly
// large sentinel population can't run past the function timeout. No cursor is needed: a healed
// sentinel is deleted outright, so re-querying findSentinelAppointments after this page naturally
// returns only what's left (see HealSentinelCaseAppointmentsUseCase.healPage's doc comment).
const HEAL_PAGE_SIZE = 25;

/**
 * handleHeal
 *
 * Queue-trigger mechanics only (dequeue, paginate-and-requeue, rate-limit retry, telemetry) —
 * mirrors trustee-verification-remap.ts's split, which keeps this layer free of the actual
 * healing business rules (resolution lookup, upsert-then-delete ordering, idempotency
 * invariants). Those live in HealSentinelCaseAppointmentsUseCase.healPage.
 *
 * Started manually by sending an initial message to the HEAL queue (same on-demand convention as
 * trustee-verification-remap and migrate-case-appointments) — there is no timer trigger. Re-run
 * as needed as trustee-professional-ids mapping data improves.
 */
async function handleHeal(
  message: HealSentinelCaseAppointmentsMessage,
  invocationContext: InvocationContext,
): Promise<void> {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new HealSentinelCaseAppointmentsUseCase(context);
    const { documentsWritten, documentsFailed, pageSize, remainingCount } =
      await useCase.healPage(HEAL_PAGE_SIZE);

    if (remainingCount > 0) {
      // The page returned a full (or partial-but-nonempty) set of sentinel rows — more may
      // remain. Re-send the message unchanged: the next invocation re-queries
      // findSentinelAppointments and naturally sees only what's left, since this page's healed
      // rows were deleted. Terminates once a page comes back empty.
      const queueClient = StorageQueueHumbleObject.fromConnectionString(
        connectionString,
        HEAL.queueName,
      );
      await queueClient.sendMessage(JSON.stringify(message));
      context.logger.info(
        MODULE_NAME,
        `Healed a page of ${pageSize} sentinel appointment(s); requeued to check for more.`,
      );
    }

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleHeal', context.logger, {
      documentsWritten,
      documentsFailed,
      success: true,
      details: {
        pageSize: String(pageSize),
        continuationQueued: String(remainingCount > 0),
      },
    });
  } catch (error) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: HEAL.queueName,
      dlqOutput: DLQ,
      context,
      moduleName: MODULE_NAME,
      activityName: 'handleHeal',
      connectionString,
    });

    if (rateLimitRetryStatus === 'retried') {
      completeDataflowTrace(
        context.observability,
        trace,
        MODULE_NAME,
        'handleHeal',
        context.logger,
        {
          documentsWritten: 0,
          documentsFailed: 0,
          success: false,
          error: 'rate-limited-requeued',
        },
      );
      return;
    }

    if (rateLimitRetryStatus === 'exhausted') {
      completeDataflowTrace(
        context.observability,
        trace,
        MODULE_NAME,
        'handleHeal',
        context.logger,
        {
          documentsWritten: 0,
          documentsFailed: 1,
          success: false,
          error: 'rate-limit-retry-exhausted',
        },
      );
      return;
    }

    throw error;
  }
}

function setup() {
  app.storageQueue(HANDLE_HEAL, {
    connection: HEAL.connection,
    queueName: HEAL.queueName,
    extraOutputs: [DLQ],
    handler: handleHeal,
  });
}

export { handleHeal };
export default {
  MODULE_NAME,
  setup,
};
