import { app, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import ModuleNames from './module-names';
import { buildFunctionName } from './dataflows-common';
import {
  TRUSTEE_MATCH_VERIFICATION_REMAP_QUEUE,
  TRUSTEE_MATCH_VERIFICATION_REMAP_DLQ,
  TRUSTEE_APPOINTMENT_EVENT_QUEUE,
} from '../../lib/storage-queues';
import factory from '../../lib/factory';
import { completeDataflowTrace } from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { handleRateLimitRetry } from './dataflows-rate-limit';
import { isTooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { resolveGroupMatchedProfessionalId } from '../../lib/use-cases/dataflows/sync-trustee-case-appointments';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import {
  TrusteeAppointmentDownstreamEvent,
  TrusteeVerificationRemapMessage,
} from '@common/cams/dataflow-events';
import { ApplicationContext } from '../../lib/adapters/types/basic';
import { TrusteeCaseAppointmentsRepository } from '../../lib/use-cases/gateways.types';
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
// letting the next invocation re-query naturally picks up only what's left (see handleRemap's
// doc comment on natural idempotency) — no offset/cursor tracking needed.
const REMAP_PAGE_SIZE = 25;

/**
 * Remaps a single surrogate CaseAppointment to the resolved real trustee: soft-close a
 * different-trustee real appointment if one exists (a genuine real->real trustee change,
 * a historical fact), upsert the canonical appointment under resolvedTrusteeId, then delete
 * the surrogate. Order is soft-close -> upsert -> delete: upserting before soft-closing would
 * transiently leave two active real rows (getActiveByCaseId's findOne would then return an
 * arbitrary one), whereas a failed upsert after a soft-close only leaves the case showing no
 * trustee — recoverable, and self-healing on retry since the surrogate is untouched until the
 * upsert succeeds. assignedOn is carried from the surrogate row (not stamped fresh) so the
 * upsert's natural key (caseId, trusteeId, assignedOn) makes retries genuinely idempotent.
 *
 * Returns whether the downstream notification failed. The Cosmos remap itself (soft-close ->
 * upsert -> delete) is the durable, retryable part of this operation and is never undone by a
 * downstream queue failure — the case is genuinely remapped either way. Signaling the downstream
 * failure back to the caller lets handleRemap tally it separately from documentsWritten, so a
 * batch with successful remaps but failed notifications is visibly partial in telemetry instead
 * of reading as a full, unqualified success.
 */
async function remapSurrogateAppointment(
  context: ApplicationContext,
  appointmentsRepo: TrusteeCaseAppointmentsRepository,
  surrogate: CaseAppointment,
  message: TrusteeVerificationRemapMessage,
): Promise<{ downstreamNotificationFailed: boolean }> {
  const existingReal = await appointmentsRepo.getActiveByCaseId(surrogate.caseId);

  if (existingReal && existingReal.trusteeId !== message.resolvedTrusteeId) {
    await appointmentsRepo.updateCaseAppointment({
      ...existingReal,
      unassignedOn: new Date().toISOString(),
    });
  }

  if (!existingReal || existingReal.trusteeId !== message.resolvedTrusteeId) {
    await appointmentsRepo.upsert({
      caseId: surrogate.caseId,
      trusteeId: message.resolvedTrusteeId,
      assignedOn: surrogate.assignedOn,
      appointedDate: surrogate.appointedDate,
      dateFiled: surrogate.dateFiled,
      chapter: surrogate.chapter,
      courtDivisionCode: surrogate.courtDivisionCode,
    });
  }

  await appointmentsRepo.delete(surrogate.id);

  if (context.featureFlags['downstream-trustee-appointments-enabled']) {
    const acmsProfessionalId = await resolveGroupMatchedProfessionalId(
      context,
      message.resolvedTrusteeId,
      surrogate.courtDivisionCode,
    );
    const openEvent: TrusteeAppointmentDownstreamEvent = {
      caseId: surrogate.caseId,
      trusteeId: message.resolvedTrusteeId,
      acmsProfessionalId,
      assignedOn: surrogate.assignedOn,
      appointedDate: surrogate.appointedDate,
      chapter: surrogate.chapter,
    };
    const apiToDataflows = factory.getApiToDataflowsGateway(context);
    try {
      await apiToDataflows.queueTrusteeAppointmentEvent(openEvent);
    } catch (queueError) {
      context.logger.error(
        MODULE_NAME,
        `Failed to queue downstream event for case ${surrogate.caseId}, trustee ${message.resolvedTrusteeId} — appointment remapped in Cosmos but downstream not notified`,
        queueError,
      );
      return { downstreamNotificationFailed: true };
    }
  }

  return { downstreamNotificationFailed: false };
}

/**
 * handleRemap
 *
 * Remaps every case sharing message.fingerprint's pending mismatch from its surrogate
 * placeholder to the resolved real trustee. Natural idempotency: a remapped case's surrogate
 * row is deleted outright, so re-querying getSurrogatesByFingerprint(fingerprint) after a
 * partial batch failure returns only the cases that haven't been remapped yet — no
 * retryCount-based skip logic is needed. The one case a retry may re-encounter is one whose
 * canonical upsert succeeded but whose surrogate delete failed; the idempotent upsert makes
 * reprocessing it a no-op and the retry completes the delete.
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
  const appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);

  try {
    const surrogates = await appointmentsRepo.getSurrogatesByFingerprint(message.fingerprint);
    const page = surrogates.slice(0, REMAP_PAGE_SIZE);
    const remainingCount = surrogates.length - page.length;

    let documentsWritten = 0;
    let documentsFailed = 0;
    let downstreamNotificationFailedCount = 0;

    for (const surrogate of page) {
      try {
        const { downstreamNotificationFailed } = await remapSurrogateAppointment(
          context,
          appointmentsRepo,
          surrogate,
          message,
        );
        documentsWritten++;
        if (downstreamNotificationFailed) {
          downstreamNotificationFailedCount++;
        }
      } catch (perCaseError) {
        // A rate-limit error is a batch-level condition, not a per-case data failure — it
        // must propagate to the outer catch so handleRateLimitRetry can back off and requeue
        // the whole batch, rather than being counted as a permanent failure for this one case
        // while the loop hammers Cosmos again for every remaining surrogate.
        if (isTooManyRequestsError(perCaseError)) {
          throw perCaseError;
        }
        documentsFailed++;
        context.logger.error(
          MODULE_NAME,
          `Failed to remap case ${surrogate.caseId} for fingerprint ${message.fingerprint} — its surrogate row is left in place for the next attempt to rediscover.`,
          perCaseError,
        );
      }
    }

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
        `Remapped a page of ${page.length} case(s) for fingerprint ${message.fingerprint}; requeued for ${remainingCount} remaining.`,
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
          totalCandidates: String(surrogates.length),
          pageSize: String(page.length),
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
    // TRUSTEE_APPOINTMENT_EVENT_QUEUE must be declared here (not just DLQ) — Azure Functions
    // only delivers extraOutputs.set() calls for outputs this specific function registered;
    // remapSurrogateAppointment's downstream-event queueing would otherwise silently no-op.
    extraOutputs: [DLQ, TRUSTEE_APPOINTMENT_EVENT_QUEUE],
    handler: handleRemap,
  });
}

export { handleRemap };
export default {
  MODULE_NAME,
  setup,
};
