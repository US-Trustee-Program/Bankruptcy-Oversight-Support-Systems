import { app, InvocationContext, Timer, output } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';

import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import SyncTrusteeCaseAppointmentsUseCase from '../../../lib/use-cases/dataflows/sync-trustee-case-appointments';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { TrusteeAppointmentsSyncState } from '../../../lib/use-cases/gateways.types';
import {
  STORAGE_QUEUE_CONNECTION,
  TRUSTEE_APPOINTMENT_EVENT_QUEUE,
} from '../../../lib/storage-queues';
import factory from '../../../lib/factory';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import {
  computeBackoffSecondsWithJitter,
  handleRateLimitRetry,
  RATE_LIMIT_RETRY_LIMIT,
} from '../dataflows-rate-limit';
import { pageByByteBudget } from '../dataflows-paging';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';

const MODULE_NAME = 'SYNC-TRUSTEE-CASE-APPOINTMENTS';
const PAGE_SIZE = 100;

// A case not yet synced by sync-cases retries twice (3 total attempts, tracked via
// PageMessage.notYetSyncedRetryCount since each retry sends a new queue message) with a 4-hour
// visibility delay, then routes to the DLQ.
const CASE_NOT_YET_SYNCED_RETRY_LIMIT = 2;
const CASE_NOT_YET_SYNCED_VISIBILITY_SECONDS = 4 * 60 * 60;

type SyncTrusteeCaseAppointmentsStartMessage = StartMessage & {
  lastSyncDate?: string;
  reset?: boolean;
  deleteAll?: boolean;
  overrideRuntimeState?: TrusteeAppointmentsSyncState;
  flushQueues?: boolean;
};

type PageMessage = {
  events: TrusteeAppointmentSyncEvent[];
  // Retry counter for the not-yet-synced-case retry policy (fixed 4-hour delay, limit
  // CASE_NOT_YET_SYNCED_RETRY_LIMIT) — deliberately NOT named retryCount. handleRateLimitRetry
  // (dataflows-rate-limit.ts) is a shared generic helper used by multiple dataflows that reads/
  // writes its own transient-infra-error counter on `message.retryCount` (exponential backoff,
  // limit RATE_LIMIT_RETRY_LIMIT) via the outer catch below. Those are two independent retry
  // policies with different limits and delays; a generic transient error hitting the outer catch
  // for a page that also has not-yet-synced events must not perturb this counter, and vice versa.
  notYetSyncedRetryCount?: number;
  retryCount?: number;
  firstAttemptAt?: string;
  // Separate retry counter for retryableEvents (transient infra errors surfaced as a business
  // outcome from processAppointments), tracked independently from both counters above. A page can
  // produce both kinds of retryable events in the same invocation, and they follow different
  // retry policies (fixed 4-hour delay vs. exponential backoff) with different limits, so they
  // cannot share one counter on a combined requeue message.
  retryableRetryCount?: number;
};

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const TIMER_TRIGGER = buildFunctionName(MODULE_NAME, 'timerTrigger');

function summarizeRejectedEvent(event: TrusteeAppointmentSyncEvent): CamsError {
  const byteSize = Buffer.byteLength(JSON.stringify(event));
  const message = `Case ${event.caseId} individually exceeds the Azure Storage Queue byte budget (${byteSize} bytes) and cannot be paged.`;
  return getCamsError(new Error(message), MODULE_NAME, message);
}

// The `page` output binding cannot be used here: extraOutputs.set() sends exactly one
// queue message per invocation, serializing whatever value it's given as one message
// body. Setting the whole array of pre-chunked pages in one call collapses them back
// into a single oversized message rather than one message per page (this is what
// caused the production 413 RequestBodyTooLarge). Each page must instead be sent as
// its own message via the imperative queue client, the same mechanism handlePage's
// retry path already uses.
async function queueEventPages(
  events: TrusteeAppointmentSyncEvent[],
  connectionString: string,
): Promise<{ pagesQueued: number; rejectedCount: number }> {
  const { pages: eventPages, rejected } = pageByByteBudget(events, PAGE_SIZE);
  const pages: PageMessage[] = eventPages.map((page) => ({ events: page }));

  const queueClient = StorageQueueHumbleObject.fromConnectionString(
    connectionString,
    PAGE.queueName,
  );
  for (const page of pages) {
    await queueClient.sendMessage(JSON.stringify(page));
  }

  if (rejected.length > 0) {
    const dlqQueueClient = StorageQueueHumbleObject.fromConnectionString(
      connectionString,
      DLQ.queueName,
    );
    for (const event of rejected) {
      const queueError = buildQueueError(summarizeRejectedEvent(event), MODULE_NAME, HANDLE_START);
      await dlqQueueClient.sendMessage(JSON.stringify(queueError));
    }
  }

  return { pagesQueued: pages.length, rejectedCount: rejected.length };
}

async function handleStart(
  startMessage: SyncTrusteeCaseAppointmentsStartMessage,
  invocationContext: InvocationContext,
) {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = factory.getObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  try {
    const connectionString = process.env.AzureWebJobsDataflowsStorage;
    if (!connectionString) {
      throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
    }

    const context = await ContextCreator.getApplicationContext({
      invocationContext,
      observability,
    });
    if (startMessage.flushQueues) {
      logger.info(
        MODULE_NAME,
        'flushQueues flag detected — no queue dump implemented yet, exiting.',
      );
      completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { mode: 'flushQueues' },
      });
      return;
    }

    const deps = SyncTrusteeCaseAppointmentsUseCase.createDeps(context);

    if (startMessage.deleteAll) {
      logger.info(MODULE_NAME, 'deleteAll flag detected — deleting all case appointment records.');
      const deleteResult = await SyncTrusteeCaseAppointmentsUseCase.deleteAll(deps);
      if (deleteResult.error) {
        invocationContext.extraOutputs.set(
          DLQ,
          buildQueueError(getCamsError(deleteResult.error, MODULE_NAME), MODULE_NAME, HANDLE_START),
        );
        completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
          documentsWritten: 0,
          documentsFailed: 0,
          success: false,
          error: deleteResult.error.message,
        });
        return;
      }
    }

    const { events, latestSyncDate, petitionLatestSyncDate } =
      await SyncTrusteeCaseAppointmentsUseCase.getAppointmentEvents(
        deps,
        startMessage.lastSyncDate,
        startMessage.reset || startMessage.deleteAll,
        startMessage.overrideRuntimeState,
      );

    if (!events.length) {
      completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
      });
      return;
    }

    const { pagesQueued, rejectedCount } = await queueEventPages(events, connectionString);

    if (latestSyncDate) {
      await SyncTrusteeCaseAppointmentsUseCase.storeRuntimeState(deps, latestSyncDate);
    }
    if (petitionLatestSyncDate) {
      await SyncTrusteeCaseAppointmentsUseCase.storePetitionRuntimeState(
        deps,
        petitionLatestSyncDate,
      );
    }
    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: rejectedCount,
      success: true,
      details: { pagesQueued: String(pagesQueued), totalEvents: String(events.length) },
    });
  } catch (originalError) {
    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: originalError instanceof Error ? originalError.message : String(originalError),
    });
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, HANDLE_START),
    );
  }
}

/**
 * handlePage
 *
 * Process a page of trustee appointment events by matching to CAMS trustees
 * and updating the SyncedCase with trusteeId.
 *
 * @param {PageMessage} message
 * @param {InvocationContext} invocationContext
 */
async function handlePage(message: PageMessage, invocationContext: InvocationContext) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const { events } = message;
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = appContext.observability.startTrace(invocationContext.invocationId);

  try {
    const deps = SyncTrusteeCaseAppointmentsUseCase.createDeps(appContext);
    const { successCount, dlqMessages, scenarioDistribution, notYetSyncedEvents, retryableEvents } =
      await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, events);

    const finalDlqMessages = [...dlqMessages];
    // Depth at which this page's retryable events arrived (0 the first time any event on the
    // page hit a transient error). Reported as a metric below so an operator can distinguish
    // "many events retrying once" from "a few events near RATE_LIMIT_RETRY_LIMIT exhaustion" --
    // undefined (surfaced as 0) when the page had no retryable events this invocation.
    let retryableRetryDepth = 0;

    if (retryableEvents.length > 0) {
      const currentRetryableRetryCount = message.retryableRetryCount ?? 0;
      retryableRetryDepth = currentRetryableRetryCount;
      if (currentRetryableRetryCount < RATE_LIMIT_RETRY_LIMIT) {
        const nextRetryableRetryCount = currentRetryableRetryCount + 1;
        const visibilityTimeout = computeBackoffSecondsWithJitter(nextRetryableRetryCount);
        const queueClient = StorageQueueHumbleObject.fromConnectionString(
          connectionString,
          PAGE.queueName,
        );
        const retryMessage: PageMessage = {
          events: retryableEvents,
          retryableRetryCount: nextRetryableRetryCount,
        };
        await queueClient.sendMessage(JSON.stringify(retryMessage), visibilityTimeout);
        appContext.logger.info(
          MODULE_NAME,
          `Requeued ${retryableEvents.length} event(s) that hit a transient error with a ${visibilityTimeout}s backoff delay (retry ${nextRetryableRetryCount}/${RATE_LIMIT_RETRY_LIMIT}).`,
        );
      } else {
        appContext.logger.error(
          MODULE_NAME,
          `Rate-limit retry limit exceeded for ${retryableEvents.length} event(s) (retry count ${currentRetryableRetryCount}) — routing to DLQ.`,
        );
        finalDlqMessages.push(...retryableEvents);
      }
    }

    if (notYetSyncedEvents.length > 0) {
      const currentRetryCount = message.notYetSyncedRetryCount ?? 0;
      if (currentRetryCount < CASE_NOT_YET_SYNCED_RETRY_LIMIT) {
        const queueClient = StorageQueueHumbleObject.fromConnectionString(
          connectionString,
          PAGE.queueName,
        );
        const retryMessage: PageMessage = {
          events: notYetSyncedEvents,
          notYetSyncedRetryCount: currentRetryCount + 1,
        };
        await queueClient.sendMessage(
          JSON.stringify(retryMessage),
          CASE_NOT_YET_SYNCED_VISIBILITY_SECONDS,
        );
        appContext.logger.info(
          MODULE_NAME,
          `Requeued ${notYetSyncedEvents.length} not-yet-synced event(s) with a ${CASE_NOT_YET_SYNCED_VISIBILITY_SECONDS}s visibility delay (retry ${currentRetryCount + 1}/${CASE_NOT_YET_SYNCED_RETRY_LIMIT}).`,
        );
      } else {
        appContext.logger.error(
          MODULE_NAME,
          `Retry limit exceeded for ${notYetSyncedEvents.length} not-yet-synced event(s) (retry count ${currentRetryCount}) — routing to DLQ.`,
        );
        finalDlqMessages.push(...notYetSyncedEvents);
      }
    }

    const totalEvents = events.length;
    const autoMatchRate =
      totalEvents > 0 ? (scenarioDistribution.autoMatchCount / totalEvents) * 100 : 0;
    const highConfidenceRate =
      totalEvents > 0 ? (scenarioDistribution.highConfidenceMatchCount / totalEvents) * 100 : 0;
    const fingerprintHitRate =
      totalEvents > 0 ? (scenarioDistribution.fingerprintHitCount / totalEvents) * 100 : 0;

    if (finalDlqMessages.length > 0) {
      const dlqQueueClient = StorageQueueHumbleObject.fromConnectionString(
        connectionString,
        DLQ.queueName,
      );
      for (const dlqMessage of finalDlqMessages) {
        await dlqQueueClient.sendMessage(JSON.stringify(dlqMessage));
      }
    }
    completeDataflowTrace(
      appContext.observability,
      trace,
      MODULE_NAME,
      'handlePage',
      appContext.logger,
      {
        documentsWritten: successCount,
        documentsFailed: finalDlqMessages.length,
        success: true,
        details: {
          totalEvents: String(totalEvents),
          autoMatchCount: String(scenarioDistribution.autoMatchCount),
          imperfectMatchCount: String(scenarioDistribution.imperfectMatchCount),
          highConfidenceMatchCount: String(scenarioDistribution.highConfidenceMatchCount),
          noMatchCount: String(scenarioDistribution.noMatchCount),
          multipleMatchCount: String(scenarioDistribution.multipleMatchCount),
          perfectMatchInactiveCount: String(scenarioDistribution.perfectMatchInactiveCount),
          reVerificationCount: String(scenarioDistribution.reVerificationCount),
          reservedIdSkippedCount: String(scenarioDistribution.reservedIdSkippedCount),
          verificationBucketHitCount: String(scenarioDistribution.verificationBucketHitCount),
          fingerprintHitCount: String(scenarioDistribution.fingerprintHitCount),
          fingerprintMissCount: String(scenarioDistribution.fingerprintMissCount),
          retryableCount: String(scenarioDistribution.retryableCount),
        },
        additionalMetrics: [
          { name: 'TrusteeAutoMatchRate', value: autoMatchRate },
          { name: 'TrusteeTotalEventsProcessed', value: totalEvents },
          { name: 'TrusteeHighConfidenceMatchRate', value: highConfidenceRate },
          {
            name: 'TrusteePerfectMatchInactiveCount',
            value: scenarioDistribution.perfectMatchInactiveCount,
          },
          { name: 'TrusteeReVerificationCount', value: scenarioDistribution.reVerificationCount },
          {
            name: 'TrusteeReservedIdSkippedCount',
            value: scenarioDistribution.reservedIdSkippedCount,
          },
          {
            name: 'TrusteeVerificationBucketHitCount',
            value: scenarioDistribution.verificationBucketHitCount,
          },
          { name: 'TrusteeFingerprintHitRate', value: fingerprintHitRate },
          { name: 'TrusteeRetryableEventCount', value: scenarioDistribution.retryableCount },
          { name: 'TrusteeRetryableRetryDepth', value: retryableRetryDepth },
        ],
      },
    );
  } catch (error) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: PAGE.queueName,
      dlqOutput: DLQ,
      context: appContext,
      moduleName: MODULE_NAME,
      activityName: 'handlePage',
      connectionString,
    });

    if (rateLimitRetryStatus === 'retried') {
      completeDataflowTrace(
        appContext.observability,
        trace,
        MODULE_NAME,
        'handlePage',
        appContext.logger,
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
        appContext.observability,
        trace,
        MODULE_NAME,
        'handlePage',
        appContext.logger,
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

async function timerTrigger(_timer: Timer, invocationContext: InvocationContext): Promise<void> {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = factory.getObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  try {
    invocationContext.extraOutputs.set(START, {});
    completeDataflowTrace(observability, trace, MODULE_NAME, 'timerTrigger', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
    });
  } catch (error) {
    completeDataflowTrace(observability, trace, MODULE_NAME, 'timerTrigger', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: START.connection,
    queueName: START.queueName,
    extraOutputs: [DLQ],
    handler: handleStart,
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: PAGE.connection,
    queueName: PAGE.queueName,
    // TRUSTEE_APPOINTMENT_EVENT_QUEUE must be declared here (not just DLQ) -- Azure Functions
    // only delivers extraOutputs.set() calls for outputs this specific function registered;
    // applyResolvedTrustee's downstream-event queueing would otherwise silently no-op. Mirrors
    // the same fix applied in trustee-verification-remap.ts.
    extraOutputs: [DLQ, TRUSTEE_APPOINTMENT_EVENT_QUEUE],
    handler: handlePage,
  });

  app.timer(TIMER_TRIGGER, {
    schedule: '0 35 9 * * *', // 5 minutes after sync-cases (at 9:30)
    extraOutputs: [START],
    handler: timerTrigger,
  });
}

export { handleStart, handlePage, timerTrigger };
export default {
  MODULE_NAME,
  setup,
};
