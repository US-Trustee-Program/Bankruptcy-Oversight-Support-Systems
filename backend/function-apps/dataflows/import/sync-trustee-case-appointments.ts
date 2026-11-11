import { randomUUID } from 'node:crypto';
import { app, InvocationContext, output, Timer } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';

import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import SyncTrusteeCaseAppointmentsUseCase from '../../../lib/use-cases/dataflows/sync-trustee-case-appointments';
import TrusteeAppointmentSyncRun from '../../../lib/use-cases/dataflows/trustee-appointment-sync-run';
import HealParkedCaseAppointments from '../../../lib/use-cases/dataflows/heal-parked-case-appointments';
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

// A transient error (ACMS timeout, Cosmos throttling) requeues the run from its resume point after a
// fixed delay. After TRANSIENT_RETRY_LIMIT requeues in a row that made no progress, the run is logged
// and dropped rather than dead-lettered. The dropped lane never completes, so the run lock stays held
// and later starts skip until an operator clears it (see TrusteeAppointmentSyncRun); the next run then
// restarts from the last bookmark written.
const TRANSIENT_RETRY_LIMIT = 5;
const TRANSIENT_REQUEUE_DELAY_SECONDS = 300;

// Fan-out lane count for a start message with no region list (see PATTERNS.md's fan-out
// section). K independent self-requeuing lane chains bound concurrent ACMS queries to K without
// relying on host.json queue settings (precedent: commit 5fbd22a29) -- this is not a semaphore,
// just how many lanes handleStart splits "every region" into. A code constant rather than an
// environment variable, so the value is reviewed and deployed with the code.
const LANE_COUNT = 4;

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

// Triggered by an operator naming regions to sync (cams-fd8qd.1.10), or with no region list to
// fan out across every CAMS region in LANE_COUNT lanes (cams-fd8qd.5.3). The sync is on
// DEFAULT_DATAFLOWS: a 12:30 UTC timer sends the regionless start, and a separate 18:30 UTC timer
// starts the heal. Both timers are registered in setup().
type SyncTrusteeCaseAppointmentsStartMessage = StartMessage & {
  /** Absent only on a top-level kickoff with no operator-named regions -- see the fan-out branch
   *  in handleStart. Every message past that point (operator-named, or one lane's chain) carries
   *  its own fixed region list. */
  regions?: string[];
  /** Identifies which lane a chain belongs to (trace details, fan-out logs, and the DLQ'd start
   *  message only) -- absent on an operator-named Slice 1 message and on the fan-out kickoff itself. */
  laneId?: number;
  /**
   * The logical run this message belongs to: minted by the first start of a run (timer or operator)
   * and copied onto every lane, continuation and requeue it spawns. A lane message whose runId no
   * longer holds the lock stops (see TrusteeAppointmentSyncRun).
   */
  runId?: string;
  /** Defaults to today when omitted; the run date itself is never read (see RegionDriver). */
  runDate?: string;
  /** Where a prior invocation that stopped early (budget or transient error) left off -- see RegionDriver's continuation. */
  resumeFrom?: RegionDriverResumePoint;
  /**
   * Transient-error requeues in a row that made no progress. Reset to 1 by a continuation that
   * advanced (moved resume point or fewer regions). Absent after a budget continuation or a fresh start.
   */
  transientRetryCount?: number;
  /**
   * Deletes appointments before syncing, and rewinds the bookmarks so the sync replaces them.
   * Scoped by this message's regions (every region when absent) and by assignedOn date range
   * (both bounds optional, inclusive). An empty object deletes every appointment in scope.
   */
  delete?: { from?: string; to?: string };
  flushQueues?: boolean;
};

// Carries only events that hit a transient error (retryableEvents). Events for cases not yet in
// CAMS are parked by the use case, not requeued here. A message still carrying the retired
// notYetSyncedRetryCount field is harmless: the field is ignored and its events now park.
type PageMessage = {
  events: TrusteeAppointmentSyncEvent[];
  // handleRateLimitRetry's own counter (shared helper, dataflows-rate-limit.ts) for a page whose
  // whole invocation failed on a transient error.
  retryCount?: number;
  firstAttemptAt?: string;
  // Separate counter for retryableEvents (transient errors surfaced per event by
  // processAppointments), so the two retry paths never perturb each other's limit.
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

const HEAL = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'heal'),
  connection: STORAGE_QUEUE_CONNECTION,
});

/**
 * One page of the daily heal of parked rows (CASE_APPOINTMENT_UNATTACHED). healRunDate is the UTC
 * date the heal timer fired and fixes the 14-day window for the whole run. lastId is absent on the
 * first page, which is also when abandoned rows are counted.
 */
type HealMessage = {
  healRunDate: string;
  lastId?: string;
  // Set by handleRateLimitRetry on a retried page only; never carried into a continuation.
  retryCount?: number;
  firstAttemptAt?: string;
};

// Rows healed serially per invocation (each is a few repository calls), as in
// heal-sentinel-case-appointments.
const HEAL_PAGE_SIZE = 25;

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_HEAL = buildFunctionName(MODULE_NAME, 'handleHeal');
const TIMER_TRIGGER = buildFunctionName(MODULE_NAME, 'timerTrigger');
const HEAL_TIMER_TRIGGER = buildFunctionName(MODULE_NAME, 'healTimerTrigger');

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
  runId: string,
  runDeps: ReturnType<typeof TrusteeAppointmentSyncRun.createDeps>,
): Promise<FanOutResult> {
  const regions = await RegionDriver.getAllRegionIds(context);
  const lanes = assignLanesRoundRobin(regions, LANE_COUNT);
  // Recorded before any lane is sent, so the last lane to finish knows to release the lock; with
  // no lanes the run is already over and this releases it.
  await TrusteeAppointmentSyncRun.setLanesRemaining(
    runDeps,
    lanes.filter((laneRegions) => laneRegions.length > 0).length,
  );

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
      runId,
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
  // Set once the delete completes, so a later requeue of this invocation does not repeat it.
  let deleteDone = false;
  // Minted up front so a requeue after a partly finished claim carries it and can pick its own lock back up.
  let runId = startMessage.runId ?? randomUUID();
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

    // A resume point only makes sense within a fixed region list; fanning out here would ignore
    // it and reschedule every region. Dead-letter the malformed message instead.
    if (!startMessage.regions && startMessage.resumeFrom) {
      throw new Error(
        'A start message with resumeFrom must carry its regions; refusing to fan out across all regions.',
      );
    }

    // Every start that is not a lane of a running sync claims the run; a lane only checks that its
    // run still holds the lock. This runs before the delete so a start that is skipped never deletes
    // appointments under an active run. The lock has no expiry: if a run dies, starts skip until an
    // operator deletes the TRUSTEE_APPOINTMENT_SYNC_RUN runtime-state document.
    const runDeps = TrusteeAppointmentSyncRun.createDeps(context);
    if (startMessage.runId && startMessage.laneId !== undefined) {
      if (!(await TrusteeAppointmentSyncRun.isCurrentRun(runDeps, startMessage.runId))) {
        logger.info(
          MODULE_NAME,
          `Run ${startMessage.runId} no longer holds the lock; this message is dropped.`,
        );
        completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
          documentsWritten: 0,
          documentsFailed: 0,
          success: true,
          details: { skipped: 'superseded-run', runId: startMessage.runId },
        });
        return;
      }
    } else {
      const claim = await TrusteeAppointmentSyncRun.claimRun(runDeps, runId);
      if ('activeRunId' in claim) {
        logger.warn(
          MODULE_NAME,
          `Run ${claim.activeRunId} holds the lock (run-active); this start is skipped. If that run died, delete the TRUSTEE_APPOINTMENT_SYNC_RUN runtime-state document after finding the cause.`,
        );
        completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
          documentsWritten: 0,
          documentsFailed: 0,
          success: true,
          details: { skipped: 'run-active', activeRunId: claim.activeRunId },
        });
        return;
      }
      runId = claim.runId;
    }

    if (startMessage.delete) {
      logger.info(MODULE_NAME, 'delete requested — deleting case appointment records.');
      const deps = SyncTrusteeCaseAppointmentsUseCase.createDeps(context);
      const deleteResult = await SyncTrusteeCaseAppointmentsUseCase.deleteAppointments(deps, {
        ...(startMessage.regions ? { regions: startMessage.regions } : {}),
        ...startMessage.delete,
      });
      if (deleteResult.error) {
        throw deleteResult.error;
      }
      deleteDone = true;
    }

    const runDate = startMessage.runDate ?? DateHelper.getTodaysIsoDate();

    if (!startMessage.regions) {
      const fanOutResult = await fanOutAcrossLanes(
        context,
        logger,
        connectionString,
        runDate,
        runId,
        runDeps,
      );
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

    // A resume point from before the delete would skip the range the delete just cleared.
    const resumeFrom = startMessage.delete ? undefined : startMessage.resumeFrom;
    // Each date's results are sent before the driver bookmarks the date (cams-fd8qd.33); results
    // for a date the driver did not finish come back on the result and are sent below.
    let dlqMessagesSent = 0;
    let pagesQueued = 0;
    const sendRecordResults = async (records: {
      dlqMessages: unknown[];
      retryableEvents: TrusteeAppointmentSyncEvent[];
    }) => {
      if (records.dlqMessages.length > 0) {
        const dlqQueueClient = StorageQueueHumbleObject.fromConnectionString(
          connectionString,
          DLQ.queueName,
        );
        for (const dlqMessage of records.dlqMessages) {
          await dlqQueueClient.sendMessage(JSON.stringify(dlqMessage));
        }
        dlqMessagesSent += records.dlqMessages.length;
      }
      // Retryable events get their first attempt at a delayed retry via the PAGE queue/handlePage,
      // which owns the backoff/retry-limit policy (see handlePage below).
      if (records.retryableEvents.length > 0) {
        pagesQueued += (await queueEventPages(records.retryableEvents, connectionString))
          .pagesQueued;
      }
    };

    const result = await RegionDriver.runRegionDriver(context, {
      regions: startMessage.regions,
      runDate,
      resumeFrom,
      onDateComplete: sendRecordResults,
    });
    await sendRecordResults(result);

    let runNotCompleted: string | undefined;
    if (result.continuation) {
      const { continuation } = result;
      const continuationMessage: SyncTrusteeCaseAppointmentsStartMessage = {
        regions: continuation.regions,
        runDate: continuation.runDate,
        resumeFrom: continuation.resumeFrom,
        laneId: startMessage.laneId,
        runId,
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

    // A chain that ends with nothing left to continue is done; the last lane releases the lock. A
    // chain whose continuation could not be requeued is not done, so the lock stays for an operator.
    if (!result.continuation) {
      await TrusteeAppointmentSyncRun.completeLane(runDeps, runId);
    }

    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: dlqMessagesSent,
      success: runNotCompleted === undefined,
      error: runNotCompleted,
      details: {
        processedRegions: result.processedRegions.join(','),
        pagesQueued: String(pagesQueued),
        continuation: String(Boolean(result.continuation)),
        laneId: String(startMessage.laneId ?? ''),
        parkedCount: String(result.parkedCount),
      },
      additionalMetrics: [{ name: 'TrusteeParkedCount', value: result.parkedCount }],
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
    // is known here, so the count simply extends the streak. delete is dropped once it has run.
    await requeueAfterTransientError(invocationContext, logger, connectionString, {
      ...startMessage,
      runId,
      transientRetryCount: (startMessage.transientRetryCount ?? 0) + 1,
      delete: deleteDone ? undefined : startMessage.delete,
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
    const { successCount, dlqMessages, scenarioDistribution, retryableEvents } =
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
          parkedCount: String(scenarioDistribution.parkedCount),
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
          { name: 'TrusteeParkedCount', value: scenarioDistribution.parkedCount },
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

/**
 * Daily at 12:30 UTC: starts a sync with no region list, which handleStart fans out across lanes.
 */
async function timerTrigger(_timer: Timer, invocationContext: InvocationContext): Promise<void> {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = factory.getObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  invocationContext.extraOutputs.set(START, {});
  completeDataflowTrace(observability, trace, MODULE_NAME, 'timerTrigger', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
  });
}

/**
 * Daily at 18:30 UTC: starts the heal of parked rows, which attaches records whose case has loaded
 * into CAMS since they were parked.
 */
async function healTimerTrigger(
  _timer: Timer,
  invocationContext: InvocationContext,
): Promise<void> {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = factory.getObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  const healStart: HealMessage = { healRunDate: DateHelper.getTodaysIsoDate() };
  invocationContext.extraOutputs.set(HEAL, healStart);
  completeDataflowTrace(observability, trace, MODULE_NAME, 'healTimerTrigger', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: { healRunDate: healStart.healRunDate },
  });
}

/**
 * handleHeal
 *
 * Queue mechanics for one heal page (cursor continuation, rate-limit retry, telemetry); the
 * healing rules live in heal-parked-case-appointments.ts. Abandoned rows (aged out of the window
 * on this run) are counted once, on the first page.
 */
async function handleHeal(message: HealMessage, invocationContext: InvocationContext) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const deps = SyncTrusteeCaseAppointmentsUseCase.createDeps(context);
    const isFirstPage = !message.lastId;
    const abandonedCount = isFirstPage
      ? await HealParkedCaseAppointments.countAbandoned(deps, message.healRunDate)
      : undefined;
    const page = await HealParkedCaseAppointments.healParkedPage(deps, {
      healRunDate: message.healRunDate,
      lastId: message.lastId ?? null,
      pageSize: HEAL_PAGE_SIZE,
    });

    if (page.nextLastId !== null) {
      const queueClient = StorageQueueHumbleObject.fromConnectionString(
        connectionString,
        HEAL.queueName,
      );
      const continuation: HealMessage = {
        healRunDate: message.healRunDate,
        lastId: page.nextLastId,
      };
      await queueClient.sendMessage(JSON.stringify(continuation));
    }

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleHeal', context.logger, {
      documentsWritten: page.healed,
      documentsFailed: page.failed,
      success: true,
      details: {
        healRunDate: message.healRunDate,
        healedCount: String(page.healed),
        stillParkedCount: String(page.stillParked),
        failedCount: String(page.failed),
        continuationQueued: String(page.nextLastId !== null),
        ...(abandonedCount !== undefined ? { abandonedCount: String(abandonedCount) } : {}),
      },
      additionalMetrics: [
        { name: 'TrusteeHealedCount', value: page.healed },
        { name: 'TrusteeStillParkedCount', value: page.stillParked },
        ...(abandonedCount !== undefined
          ? [{ name: 'TrusteeAbandonedCount', value: abandonedCount }]
          : []),
      ],
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

    if (rateLimitRetryStatus === 'retried' || rateLimitRetryStatus === 'exhausted') {
      const retried = rateLimitRetryStatus === 'retried';
      completeDataflowTrace(
        context.observability,
        trace,
        MODULE_NAME,
        'handleHeal',
        context.logger,
        {
          documentsWritten: 0,
          documentsFailed: retried ? 0 : 1,
          success: false,
          error: retried ? 'rate-limited-requeued' : 'rate-limit-retry-exhausted',
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

  app.storageQueue(HANDLE_HEAL, {
    connection: HEAL.connection,
    queueName: HEAL.queueName,
    extraOutputs: [DLQ],
    handler: handleHeal,
  });

  app.timer(TIMER_TRIGGER, {
    // Daily at 12:30 UTC (CAMS-955 Slice 3): regionless start that fans out across every region.
    schedule: '0 30 12 * * *',
    extraOutputs: [START],
    handler: timerTrigger,
  });

  app.timer(HEAL_TIMER_TRIGGER, {
    // Daily at 18:30 UTC (CAMS-955 Slice 3 decision 16): heals parked rows filed in the last 14 days.
    schedule: '0 30 18 * * *',
    extraOutputs: [HEAL],
    handler: healTimerTrigger,
  });
}

export { handleStart, handlePage, handleHeal, timerTrigger, healTimerTrigger };
export default {
  MODULE_NAME,
  setup,
};
