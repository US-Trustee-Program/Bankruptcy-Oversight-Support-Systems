import { app, InvocationContext, output } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';

import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import SyncTrusteeCaseAppointmentsUseCase from '../../../lib/use-cases/dataflows/sync-trustee-case-appointments';
import RegionDriver, {
  isTransientError,
  RegionDriverResumePoint,
} from '../../../lib/use-cases/dataflows/trustee-appointment-region-driver';
import {
  assignLanesRoundRobin,
  pickJitterSeconds,
} from '../../../lib/use-cases/dataflows/lane-assignment';
import { buildQueueError, QueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import DateHelper from '@common/date-helper';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import factory from '../../../lib/factory';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
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

// A transient error (ACMS timeout, Cosmos throttling) requeues the run from its resume point after a
// fixed delay. After TRANSIENT_RETRY_LIMIT requeues in a row that made no progress, the run is logged
// and dropped rather than dead-lettered: a later run restarts from the last bookmark written.
const TRANSIENT_RETRY_LIMIT = 5;
const TRANSIENT_REQUEUE_DELAY_SECONDS = 300;

// Fan-out lane count for a start message with no region list (see PATTERNS.md's fan-out
// section). K independent self-requeuing lane chains bound concurrent ACMS queries to K without
// relying on host.json queue settings (precedent: commit 5fbd22a29) -- this is not a semaphore,
// just how many lanes handleStart splits "every region" into. Defaults to 3, capped at
// MAX_LANE_COUNT so a typo (e.g. 30) cannot open that many concurrent ACMS chains.
const DEFAULT_LANE_COUNT = 3;
const MAX_LANE_COUNT = 10;

/**
 * Read fresh on every fan-out (not cached at module load, unlike e.g. ACMS_REQUEST_TIMEOUT_MS):
 * an env var this cheap to re-parse doesn't need load-time caching, and reading it fresh lets
 * tests set it per-case without vi.resetModules() gymnastics.
 */
function getLaneCount(logger: ReturnType<typeof ContextCreator.getLogger>): number {
  const raw = process.env.TRUSTEE_APPOINTMENT_LANE_COUNT;
  if (!raw) return DEFAULT_LANE_COUNT;
  // Number(), not parseInt: parseInt would accept "3abc" as 3 and "2.5" as 2.
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    logger.warn(
      MODULE_NAME,
      `Invalid TRUSTEE_APPOINTMENT_LANE_COUNT="${raw}", using default ${DEFAULT_LANE_COUNT}`,
    );
    return DEFAULT_LANE_COUNT;
  }
  if (parsed > MAX_LANE_COUNT) {
    logger.warn(
      MODULE_NAME,
      `TRUSTEE_APPOINTMENT_LANE_COUNT="${raw}" exceeds the maximum of ${MAX_LANE_COUNT}, using ${MAX_LANE_COUNT}`,
    );
    return MAX_LANE_COUNT;
  }
  return parsed;
}

// A random delay on each lane's first message only, so K lanes don't all query ACMS in the same
// instant at run start. Continuation/next-date/next-region pages carry no delay (unchanged).
const LANE_JITTER_MIN_SECONDS = 30;
const LANE_JITTER_MAX_SECONDS = 60;

function sameResumePoint(
  a: RegionDriverResumePoint | undefined,
  b: RegionDriverResumePoint | undefined,
): boolean {
  if (!a || !b) return a === b;
  return a.regionId === b.regionId && a.date === b.date && a.lastId === b.lastId;
}

/** A continuation progressed when it moved the resume point or left fewer regions to run. */
function hasProgressed(
  incoming: { regions: string[]; resumeFrom?: RegionDriverResumePoint },
  continuation: { regions: string[]; resumeFrom?: RegionDriverResumePoint },
): boolean {
  return (
    !sameResumePoint(incoming.resumeFrom, continuation.resumeFrom) ||
    continuation.regions.length < incoming.regions.length
  );
}

// Manually triggered by an operator naming regions to sync (cams-fd8qd.1.10), or with no region
// list to fan out across every CAMS region in LANE_COUNT lanes (cams-fd8qd.5.3) -- not on
// DEFAULT_DATAFLOWS and no timer trigger until parking/healing land (Slice 3).
type SyncTrusteeCaseAppointmentsStartMessage = StartMessage & {
  /** Absent only on a top-level kickoff with no operator-named regions -- see the fan-out branch
   *  in handleStart. Every message past that point (operator-named, or one lane's chain) carries
   *  its own fixed region list. */
  regions?: string[];
  /** Identifies which lane a chain belongs to (trace details, fan-out logs, and the DLQ'd start
   *  message only) -- absent on an operator-named Slice 1 message and on the fan-out kickoff itself. */
  laneId?: number;
  /** Defaults to today when omitted; the run date itself is never read (see RegionDriver). */
  runDate?: string;
  /** Where a prior invocation that stopped early (budget or transient error) left off -- see RegionDriver's continuation. */
  resumeFrom?: RegionDriverResumePoint;
  /**
   * Transient-error requeues in a row that made no progress. Reset to 1 by a continuation that
   * advanced (moved resume point or fewer regions). Absent after a budget continuation or a fresh start.
   */
  transientRetryCount?: number;
  deleteAll?: boolean;
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

type StartQueueError = QueueError & { startMessage: SyncTrusteeCaseAppointmentsStartMessage };

/**
 * Dead-letters an error together with the start message that produced it, so the run can be
 * replayed by hand. QueueError has no payload slot, so the message is attached here.
 */
function deadLetterWithStartMessage(
  invocationContext: InvocationContext,
  error: CamsError,
  startMessage: SyncTrusteeCaseAppointmentsStartMessage,
): void {
  const entry: StartQueueError = {
    ...buildQueueError(error, MODULE_NAME, HANDLE_START),
    startMessage,
  };
  invocationContext.extraOutputs.set(DLQ, entry);
}

/**
 * Re-enqueues a start message for a later attempt after the transient delay. The message's count
 * is already set by the caller. Returns undefined when the message was re-enqueued, otherwise a
 * description of why the run was not re-enqueued (retry limit spent, or the send failed and the
 * message was dead-lettered instead).
 */
async function requeueAfterTransientError(
  invocationContext: InvocationContext,
  logger: ReturnType<typeof ContextCreator.getLogger>,
  connectionString: string,
  message: SyncTrusteeCaseAppointmentsStartMessage,
): Promise<string | undefined> {
  if ((message.transientRetryCount ?? 0) > TRANSIENT_RETRY_LIMIT) {
    const description = `Transient errors persisted through ${TRANSIENT_RETRY_LIMIT} requeues; the run was not re-enqueued.`;
    const details = `${description} Regions: ${message.regions?.join(',') ?? '(fan-out: all regions)'}. Resume point: ${JSON.stringify(message.resumeFrom ?? null)}.`;
    logger.error(MODULE_NAME, details, getCamsError(new Error(details), MODULE_NAME, details));
    return description;
  }

  const startQueueClient = StorageQueueHumbleObject.fromConnectionString(
    connectionString,
    START.queueName,
  );
  try {
    await startQueueClient.sendMessage(JSON.stringify(message), TRANSIENT_REQUEUE_DELAY_SECONDS);
    return undefined;
  } catch (sendError) {
    deadLetterWithStartMessage(invocationContext, sendError, message);
    return 'The transient re-enqueue failed; the run was dead-lettered with its start message.';
  }
}

type FanOutResult = { lanesCreated: number; regionsScheduled: number };

/**
 * A top-level kickoff with no region list: enumerates every CAMS region, splits it into
 * LANE_COUNT lanes, and sends one START message per non-empty lane -- each becomes its own
 * independent chain from here on, indistinguishable from an operator-named Slice 1 message
 * except for carrying laneId. This invocation does no driver work itself. Zero regions found
 * means zero lanes are non-empty, so zero messages are sent; handleStart reports that as a failed
 * run, since CAMS office data with no regions means a misconfigured or empty DXTR source.
 */
async function fanOutAcrossLanes(
  context: ApplicationContext,
  logger: ReturnType<typeof ContextCreator.getLogger>,
  connectionString: string,
  runDate: string,
): Promise<FanOutResult> {
  const regions = await RegionDriver.getAllRegionIds(context);
  const lanes = assignLanesRoundRobin(regions, getLaneCount(logger));

  const startQueueClient = StorageQueueHumbleObject.fromConnectionString(
    connectionString,
    START.queueName,
  );

  let lanesCreated = 0;
  for (const [laneId, laneRegions] of lanes.entries()) {
    if (laneRegions.length === 0) continue;
    const laneMessage: SyncTrusteeCaseAppointmentsStartMessage = {
      regions: laneRegions,
      runDate,
      laneId,
    };
    const jitterSeconds = pickJitterSeconds(LANE_JITTER_MIN_SECONDS, LANE_JITTER_MAX_SECONDS);
    await startQueueClient.sendMessage(JSON.stringify(laneMessage), jitterSeconds);
    logger.info(
      MODULE_NAME,
      `Fan-out lane ${laneId}: ${laneRegions.length} region(s) [${laneRegions.join(',')}], first message delayed ${jitterSeconds}s.`,
    );
    lanesCreated++;
  }

  return { lanesCreated, regionsScheduled: regions.length };
}

async function handleStart(
  startMessage: SyncTrusteeCaseAppointmentsStartMessage,
  invocationContext: InvocationContext,
) {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = factory.getObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  // Set once deleteAll completes, so a later requeue of this invocation does not repeat the reset.
  let deleteAllDone = false;
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

    if (startMessage.deleteAll) {
      logger.info(MODULE_NAME, 'deleteAll flag detected — deleting all case appointment records.');
      const deps = SyncTrusteeCaseAppointmentsUseCase.createDeps(context);
      const deleteResult = await SyncTrusteeCaseAppointmentsUseCase.deleteAll(deps);
      if (deleteResult.error) {
        throw deleteResult.error;
      }
      deleteAllDone = true;
    }

    const runDate = startMessage.runDate ?? DateHelper.getTodaysIsoDate();

    if (!startMessage.regions) {
      // A resume point only makes sense within a fixed region list; fanning out here would ignore
      // it and reschedule every region. Dead-letter the malformed message instead.
      if (startMessage.resumeFrom) {
        throw new Error(
          'A start message with resumeFrom must carry its regions; refusing to fan out across all regions.',
        );
      }
      const fanOutResult = await fanOutAcrossLanes(context, logger, connectionString, runDate);
      const noRegionsFound =
        fanOutResult.regionsScheduled === 0
          ? 'No regions found in CAMS office data; no lanes were scheduled.'
          : undefined;
      if (noRegionsFound) {
        logger.warn(MODULE_NAME, noRegionsFound);
      }
      completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: noRegionsFound === undefined,
        error: noRegionsFound,
        details: {
          lanesCreated: String(fanOutResult.lanesCreated),
          regionsScheduled: String(fanOutResult.regionsScheduled),
        },
      });
      return;
    }

    // A resume point from before a deleteAll reset would skip the history the reset just cleared.
    const resumeFrom = startMessage.deleteAll ? undefined : startMessage.resumeFrom;
    const result = await RegionDriver.runRegionDriver(context, {
      regions: startMessage.regions,
      runDate,
      resumeFrom,
    });

    if (result.dlqMessages.length > 0) {
      const dlqQueueClient = StorageQueueHumbleObject.fromConnectionString(
        connectionString,
        DLQ.queueName,
      );
      for (const dlqMessage of result.dlqMessages) {
        await dlqQueueClient.sendMessage(JSON.stringify(dlqMessage));
      }
    }

    // Retryable/not-yet-synced events get their first attempt at a delayed retry via the
    // existing PAGE queue/handlePage, which already owns the backoff/retry-limit policies for
    // both kinds (see handlePage below) -- unchanged since before this dataflow's rewrite.
    let pagesQueued = 0;
    if (result.retryableEvents.length > 0) {
      pagesQueued += (await queueEventPages(result.retryableEvents, connectionString)).pagesQueued;
    }
    if (result.notYetSyncedEvents.length > 0) {
      pagesQueued += (await queueEventPages(result.notYetSyncedEvents, connectionString))
        .pagesQueued;
    }

    let runNotCompleted: string | undefined;
    if (result.continuation) {
      const { continuation } = result;
      const continuationMessage: SyncTrusteeCaseAppointmentsStartMessage = {
        regions: continuation.regions,
        runDate: continuation.runDate,
        resumeFrom: continuation.resumeFrom,
        laneId: startMessage.laneId,
      };
      if (continuation.cause === 'invocation-budget') {
        // A budget continuation starts a fresh transient-retry streak, so it carries no count.
        const startQueueClient = StorageQueueHumbleObject.fromConnectionString(
          connectionString,
          START.queueName,
        );
        await startQueueClient.sendMessage(JSON.stringify(continuationMessage));
      } else {
        // A continuation that advanced starts a new streak; one that did not extends the current one.
        const transientRetryCount = hasProgressed(
          { regions: startMessage.regions, resumeFrom: startMessage.resumeFrom },
          continuation,
        )
          ? 1
          : (startMessage.transientRetryCount ?? 0) + 1;
        runNotCompleted = await requeueAfterTransientError(
          invocationContext,
          logger,
          connectionString,
          {
            ...continuationMessage,
            transientRetryCount,
          },
        );
      }
    }

    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: result.dlqMessages.length,
      success: runNotCompleted === undefined,
      error: runNotCompleted,
      details: {
        processedRegions: result.processedRegions.join(','),
        pagesQueued: String(pagesQueued),
        continuation: String(Boolean(result.continuation)),
        laneId: String(startMessage.laneId ?? ''),
      },
    });
  } catch (originalError) {
    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: originalError instanceof Error ? originalError.message : String(originalError),
    });

    const connectionString = process.env.AzureWebJobsDataflowsStorage;
    if (!isTransientError(originalError) || !connectionString) {
      deadLetterWithStartMessage(invocationContext, originalError, startMessage);
      return;
    }
    // Requeues the original message, not a continuation: nothing about this invocation's progress
    // is known here, so the count simply extends the streak. deleteAll is dropped once it has run.
    await requeueAfterTransientError(invocationContext, logger, connectionString, {
      ...startMessage,
      transientRetryCount: (startMessage.transientRetryCount ?? 0) + 1,
      deleteAll: deleteAllDone ? undefined : startMessage.deleteAll,
    });
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
          autoMatchUncoveredCount: String(scenarioDistribution.autoMatchUncoveredCount),
          noMatchCount: String(scenarioDistribution.noMatchCount),
          multipleMatchCount: String(scenarioDistribution.multipleMatchCount),
          pipelineSkippedCount: String(scenarioDistribution.pipelineSkippedCount),
          reVerificationCount: String(scenarioDistribution.reVerificationCount),
          verificationBucketHitCount: String(scenarioDistribution.verificationBucketHitCount),
          fingerprintHitCount: String(scenarioDistribution.fingerprintHitCount),
          fingerprintMissCount: String(scenarioDistribution.fingerprintMissCount),
          retryableCount: String(scenarioDistribution.retryableCount),
        },
        additionalMetrics: [
          { name: 'TrusteeAutoMatchRate', value: autoMatchRate },
          { name: 'TrusteeTotalEventsProcessed', value: totalEvents },
          {
            name: 'TrusteePipelineSkippedCount',
            value: scenarioDistribution.pipelineSkippedCount,
          },
          { name: 'TrusteeReVerificationCount', value: scenarioDistribution.reVerificationCount },
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
    extraOutputs: [DLQ],
    handler: handlePage,
  });
}

export { handleStart, handlePage };
export default {
  MODULE_NAME,
  setup,
};
