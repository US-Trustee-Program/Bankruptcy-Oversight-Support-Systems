import { app, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import ModuleNames from './module-names';
import { buildFunctionName } from './dataflows-common';
import {
  TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE,
  TRUSTEE_MATCH_VERIFICATION_REMAP_DLQ,
} from '../../lib/storage-queues';
import { completeDataflowTrace } from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { handleRateLimitRetry } from './dataflows-rate-limit';
import TrusteeVerificationRemapUseCase from '../../lib/use-cases/dataflows/trustee-verification-remap';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';

const MODULE_NAME = ModuleNames.TRUSTEE_MATCH_VERIFICATION_REMAP;
const HANDLE_REMAP = buildFunctionName(MODULE_NAME, 'handleRemap');

const REMAP = TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE;
const DLQ = TRUSTEE_MATCH_VERIFICATION_REMAP_DLQ;

// Bounds how many surrogates a single invocation remaps serially, so a fingerprint with an
// unexpectedly large fan-out can't run past the function timeout. Deliberately smaller than
// the UI's AFFECTED_CASE_COUNT_SANITY_CAP (50) — that constant bounds what's surfaced to a
// reviewer, this one bounds work done per invocation. Re-querying is what makes continuation
// safe: a remapped case's surrogate is deleted, so re-sending the same message unchanged and
// letting the next invocation re-query naturally picks up only what's left (see
// TrusteeVerificationRemapUseCase.remapPage's doc comment on natural idempotency) — no
// offset/cursor tracking needed.
const REMAP_PAGE_SIZE = 25;

/**
 * handleRemap
 *
 * Queue-trigger mechanics only (dequeue, paginate-and-requeue, rate-limit retry, telemetry) —
 * mirrors sync-trustee-case-appointments.ts's split, which keeps this layer free of the actual
 * remap business rules (soft-close-before-upsert ordering, idempotency invariants). Those live
 * in TrusteeVerificationRemapUseCase.remapPage.
 */
async function handleRemap(
  message: TrusteeVerificationRemapMessage,
  invocationContext: InvocationContext,
): Promise<void> {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new TrusteeVerificationRemapUseCase(context);
    const {
      documentsWritten,
      documentsFailed,
      downstreamNotificationFailedCount,
      totalCandidates,
      pageSize,
      remainingCount,
    } = await useCase.remapPage(message, REMAP_PAGE_SIZE);

    if (remainingCount > 0) {
      // Re-send the message unchanged: the next invocation re-queries
      // getSurrogatesByFingerprint and naturally sees only the surrogates that haven't been
      // remapped yet (this invocation's page had its surrogates deleted as they were remapped)
      // — no offset/cursor needs to travel with the message.
      const queueClient = StorageQueueHumbleObject.fromConnectionString(
        connectionString,
        REMAP.queueName,
      );
      await queueClient.sendMessage(JSON.stringify(message));
      context.logger.info(
        MODULE_NAME,
        `Remapped a page of ${pageSize} case(s) for fingerprint ${message.fingerprint}; requeued for ${remainingCount} remaining.`,
      );
    }

    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'handleRemap',
      context.logger,
      {
        documentsWritten,
        documentsFailed,
        success: true,
        details: {
          fingerprint: message.fingerprint,
          verificationId: message.verificationId,
          totalCandidates: String(totalCandidates),
          pageSize: String(pageSize),
          continuationQueued: String(remainingCount > 0),
          // A case counted here also counts toward documentsWritten above -- the Cosmos remap
          // (soft-close -> upsert -> delete) succeeded, only the downstream notification failed.
          // Kept distinct so a partially-successful batch doesn't read as fully successful.
          downstreamNotificationFailedCount: String(downstreamNotificationFailedCount),
        },
        additionalMetrics: [
          {
            name: 'TrusteeVerificationRemapDownstreamNotificationFailedCount',
            value: downstreamNotificationFailedCount,
          },
        ],
      },
    );
  } catch (error) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: REMAP.queueName,
      dlqOutput: DLQ,
      context,
      moduleName: MODULE_NAME,
      activityName: 'handleRemap',
      connectionString,
    });

    if (rateLimitRetryStatus === 'retried') {
      completeDataflowTrace(
        context.observability,
        trace,
        MODULE_NAME,
        'handleRemap',
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
        'handleRemap',
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
  app.storageQueue(HANDLE_REMAP, {
    connection: REMAP.connection,
    queueName: REMAP.queueName,
    extraOutputs: [DLQ],
    handler: handleRemap,
  });
}

export { handleRemap };
export default {
  MODULE_NAME,
  setup,
};
