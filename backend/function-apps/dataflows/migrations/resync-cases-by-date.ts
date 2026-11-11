import { app, InvocationContext, output } from '@azure/functions';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import SyncCases from '../../../lib/use-cases/dataflows/sync-cases';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { isNotFoundError } from '../../../lib/common-errors/not-found-error';
import { isTransientInfraError } from '../../../lib/common-errors/transient-infra-error';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import {
  ReceivedQueueMessage,
  StorageQueueHumbleObject,
} from '../../../lib/humble-objects/storage-queue-humble';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import {
  handleRateLimitRetry,
  RATE_LIMIT_RETRY_LIMIT,
  requeueSingleEventWithBackoff,
} from '../dataflows-rate-limit';
import {
  buildQueueError,
  isQueueError,
  QueueError,
} from '../../../lib/use-cases/dataflows/queue-types';
import { CamsError } from '../../../lib/common-errors/cams-error';
import {
  DEFAULT_INVOCATION_BUDGET_MS,
  shouldEscape,
} from '../../../lib/use-cases/dataflows/invocation-budget';
import type { ApplicationContext } from '../../../lib/adapters/types/basic';
import type { ObservabilityTrace } from '../../../lib/use-cases/gateways.types';
import { FIX_QUEUE_NAME } from './division-change-cleanup';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.RESYNC_CASES_BY_DATE;
const PAGE_SIZE = 100;
const NEVER_EXPIRES = -1;
const PAGE_SEND_CONCURRENCY = 16;
const LANE_COUNT_ENV = 'RESYNC_CASES_BY_DATE_LANE_COUNT';
const DEFAULT_LANE_COUNT = 40;
const TARGET_RU_PER_SEC_ENV = 'RESYNC_CASES_BY_DATE_TARGET_RU_PER_SEC';
const RU_PER_CASE_ENV = 'RESYNC_CASES_BY_DATE_RU_PER_CASE';
const DEFAULT_TARGET_RU_PER_SEC = 4000;
const DEFAULT_RU_PER_CASE = 19;
// Lease on a page while a lane works it. The lease is not renewed; a page still in progress
// after this long becomes visible again and another lane picks it up.
const PAGE_LEASE_SECONDS = 300;
// A page is put back once the next case would end within this margin of its lease expiring.
const PAGE_LEASE_SAFETY_MARGIN_MS = 30_000;
// Cost assumed for the first case of an invocation, before any case has been measured.
const SEED_CASE_COST_MS = 10_000;
const CASE_COST_MARGIN_MS = 5_000;
const EMPTY_QUEUE_RECHECK_SECONDS = 30;
const RATE_LIMIT_PAUSE_SECONDS = 5;
const RATE_LIMIT_JITTER_SECONDS = 5;
const LOST_CASES_EVENT = 'ResyncCasesByDateLostCases';

type LaneOutcome = 'completed-lane' | 'escaped' | 'rate-limited' | 'waiting' | 'error';

type PageOutcome = 'completed' | 'escaped' | 'rate-limited' | 'lease-expiring';

type PageEvent = Pick<CaseSyncEvent, 'type' | 'caseId'>;

type OpenPage = {
  receipt: ReceivedQueueMessage;
  body: ResyncCasesByDatePageMessage;
  startedAt: number;
  nextIndex: number;
  results: CaseSyncEvent[];
  msSlept: number;
  transientCount: number;
};

type LaneRun = {
  context: ApplicationContext;
  trace: ObservabilityTrace;
  message: ResyncCasesByDateWriterMessage;
  startedAt: number;
  casesPerSec: number;
  longestCaseMs?: number;
  casesDone: number;
  casesWritten: number;
  casesFailed: number;
  queues: {
    page: StorageQueueHumbleObject;
    writer: StorageQueueHumbleObject;
    fix: StorageQueueHumbleObject;
    dlq: StorageQueueHumbleObject;
  };
};

type ResyncCasesByDateStartMessage = {
  fromDate: string;
  retryCount?: number;
  firstAttemptAt?: string;
};

type ResyncCasesByDatePageMessage = {
  events: CaseSyncEvent[];
  retryCount?: number;
  firstAttemptAt?: string;
};

type ResyncCasesByDateWriterMessage = {
  runId: string;
  laneId: number;
  emptyChecks?: number;
};

const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const PAGE = {
  queueName: buildQueueName(MODULE_NAME, 'page'),
};

const WRITER = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'writer'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const RETRY = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'retry'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HARD_STOP = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'hard-stop'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const FIX = output.storageQueue({
  queueName: FIX_QUEUE_NAME,
  connection: STORAGE_QUEUE_CONNECTION,
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_WRITER = buildFunctionName(MODULE_NAME, 'handleWriter');
const HANDLE_ERROR = buildFunctionName(MODULE_NAME, 'handleError');
const HANDLE_RETRY = buildFunctionName(MODULE_NAME, 'handleRetry');

function readPositiveSetting(name: string, fallback: number, mustBeInteger = false): number {
  const value = Number(process.env[name]);
  const valid = Number.isFinite(value) && value > 0 && (!mustBeInteger || Number.isInteger(value));
  return valid ? value : fallback;
}

/**
 * Operators start one resync-cases-by-date run at a time. A second START issued while a run is
 * still in progress adds another K lane writers to the same PAGE queue; there is no run lock.
 */
export async function handleStart(
  message: ResyncCasesByDateStartMessage,
  invocationContext: InvocationContext,
) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const { fromDate } = message;
  if (!fromDate) {
    logger.error(MODULE_NAME, 'fromDate is required in the start message.');
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      details: { reason: 'missing fromDate' },
    });
    return;
  }

  logger.info(MODULE_NAME, `Starting resync of cases by date with fromDate: ${fromDate}`);

  let events: CaseSyncEvent[];
  try {
    ({ events } = await SyncCases.getCaseIds(context, fromDate));
  } catch (originalError) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error: originalError,
      message,
      checkQueueName: START.queueName,
      dlqOutput: DLQ,
      context,
      moduleName: MODULE_NAME,
      activityName: 'handleStart',
      connectionString,
    });

    if (rateLimitRetryStatus === 'retried') {
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: 'rate-limited-requeued',
      });
      return;
    }

    if (rateLimitRetryStatus === 'exhausted') {
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 1,
        success: false,
        error: 'rate-limit-retry-exhausted',
      });
      return;
    }

    throw originalError;
  }

  if (!events.length) {
    logger.info(MODULE_NAME, `No cases found since ${fromDate}. Nothing to resync.`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { reason: 'no cases found' },
    });
    return;
  }

  const pages: ResyncCasesByDatePageMessage[] = [];
  let start = 0;
  let end = 0;
  while (end < events.length) {
    start = end;
    end += PAGE_SIZE;
    pages.push({ events: events.slice(start, end) });
  }

  const pageQueue = StorageQueueHumbleObject.fromConnectionString(connectionString, PAGE.queueName);
  for (let i = 0; i < pages.length; i += PAGE_SEND_CONCURRENCY) {
    await Promise.all(
      pages
        .slice(i, i + PAGE_SEND_CONCURRENCY)
        .map((page) => pageQueue.sendMessage(JSON.stringify(page), undefined, NEVER_EXPIRES)),
    );
  }

  const laneCount = readPositiveSetting(LANE_COUNT_ENV, DEFAULT_LANE_COUNT, true);
  const lanes: ResyncCasesByDateWriterMessage[] = Array.from(
    { length: laneCount },
    (_, laneId) => ({
      runId: invocationContext.invocationId,
      laneId,
    }),
  );
  invocationContext.extraOutputs.set(WRITER, lanes);

  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: {
      pagesQueued: String(pages.length),
      totalEvents: String(events.length),
      lanesStarted: String(lanes.length),
    },
  });
}

function readCasesPerSecPerLane(): number {
  const laneCount = readPositiveSetting(LANE_COUNT_ENV, DEFAULT_LANE_COUNT, true);
  const targetRuPerSec = readPositiveSetting(TARGET_RU_PER_SEC_ENV, DEFAULT_TARGET_RU_PER_SEC);
  const ruPerCase = readPositiveSetting(RU_PER_CASE_ENV, DEFAULT_RU_PER_CASE);
  return targetRuPerSec / laneCount / ruPerCase;
}

/**
 * Milliseconds a lane waits so that casesDone cases never finish faster than casesPerSec allows,
 * measured from invocation start. Zero when the lane is already at or behind schedule.
 */
export function computePacingSleepMs(
  casesDone: number,
  casesPerSec: number,
  elapsedMs: number,
): number {
  return Math.floor(Math.max(0, (casesDone / casesPerSec) * 1000 - elapsedMs));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextCaseCostMs(run: LaneRun): number {
  return (run.longestCaseMs ?? SEED_CASE_COST_MS) + CASE_COST_MARGIN_MS;
}

function isOutOfBudget(run: LaneRun): boolean {
  return shouldEscape(run.startedAt, DEFAULT_INVOCATION_BUDGET_MS, nextCaseCostMs(run));
}

function isLeaseExpiring(run: LaneRun, page: OpenPage): boolean {
  return shouldEscape(
    page.startedAt,
    PAGE_LEASE_SECONDS * 1000 - PAGE_LEASE_SAFETY_MARGIN_MS,
    nextCaseCostMs(run),
  );
}

function laneRestartDelaySeconds(): number {
  return RATE_LIMIT_PAUSE_SECONDS + Math.floor(Math.random() * (RATE_LIMIT_JITTER_SECONDS + 1));
}

function sendLane(run: LaneRun, message: ResyncCasesByDateWriterMessage, delaySeconds?: number) {
  return run.queues.writer.sendMessage(JSON.stringify(message), delaySeconds);
}

async function publishResults(queues: LaneRun['queues'], results: CaseSyncEvent[]) {
  const divisionChanges = results
    .filter((event) => event.divisionChange !== undefined && !event.error)
    .map((event) => event.divisionChange!);
  const failedEvents = results.filter((event) => !!event.error);
  await Promise.all([
    ...divisionChanges.map((change) => queues.fix.sendMessage(JSON.stringify(change))),
    ...failedEvents.map((event) => queues.dlq.sendMessage(JSON.stringify(event))),
  ]);
}

/**
 * Puts the cases a lane did not finish back on the PAGE queue with the retry count bumped. Once a
 * page has used RATE_LIMIT_RETRY_LIMIT retries, its unfinished cases go to DLQ and a telemetry
 * event names them instead.
 */
async function putBackOrLose(run: LaneRun, page: OpenPage, unfinished: PageEvent[]) {
  const retryCount = page.body.retryCount ?? 0;
  const firstAttemptAt = page.body.firstAttemptAt ?? new Date().toISOString();
  const events = unfinished.map(({ type, caseId }) => ({ type, caseId }));

  if (retryCount < RATE_LIMIT_RETRY_LIMIT) {
    const continuation: ResyncCasesByDatePageMessage = {
      events,
      retryCount: retryCount + 1,
      firstAttemptAt,
    };
    await run.queues.page.sendMessage(JSON.stringify(continuation), undefined, NEVER_EXPIRES);
    return;
  }

  const error = new CamsError(MODULE_NAME, {
    message: `Page retry limit of ${RATE_LIMIT_RETRY_LIMIT} reached; ${events.length} cases were not synced.`,
  });
  const lostPage = {
    ...buildQueueError(error, MODULE_NAME, 'handleWriter'),
    retryCount,
    message: { events, retryCount, firstAttemptAt },
  };
  await run.queues.dlq.sendMessage(JSON.stringify(lostPage));
  run.context.observability.completeTrace(
    run.trace,
    LOST_CASES_EVENT,
    {
      success: false,
      properties: {
        moduleName: MODULE_NAME,
        runId: run.message.runId,
        laneId: String(run.message.laneId),
        firstAttemptAt,
        caseIds: events.map((event) => event.caseId).join(','),
      },
      measurements: { caseCount: events.length },
    },
    undefined,
    run.context.logger,
  );
}

/**
 * Closes out a page: publishes its results, puts back any unfinished cases, then deletes the
 * original message. Follow-up sends happen before the delete, so a crash in between leaves a
 * duplicate page rather than losing cases.
 */
async function endPage(
  run: LaneRun,
  page: OpenPage,
  unfinished: PageEvent[],
  outcome: PageOutcome,
) {
  await publishResults(run.queues, page.results);
  if (unfinished.length > 0) {
    await putBackOrLose(run, page, unfinished);
  }
  const deleted = await run.queues.page.deleteMessage(
    page.receipt.messageId,
    page.receipt.popReceipt,
  );
  if (!deleted) {
    run.context.logger.warn(
      MODULE_NAME,
      `Page lease already reclaimed by another lane: runId=${run.message.runId} laneId=${run.message.laneId} messageId=${page.receipt.messageId}`,
    );
  }
  run.context.logger.info(
    MODULE_NAME,
    `Page closed: runId=${run.message.runId} laneId=${run.message.laneId} durationMs=${Date.now() - page.startedAt} casesCompleted=${page.results.length} casesPutBack=${unfinished.length} msSlept=${page.msSlept} transientCount=${page.transientCount} retryCount=${page.body.retryCount ?? 0} outcome=${outcome}`,
  );
}

async function handleEmptyPageQueue(run: LaneRun): Promise<LaneOutcome> {
  const { runId, laneId, emptyChecks } = run.message;
  const pendingMessages = await run.queues.page.getApproximateMessageCount();
  if (pendingMessages > 0) {
    await sendLane(run, { runId, laneId }, EMPTY_QUEUE_RECHECK_SECONDS);
    return 'waiting';
  }
  if ((emptyChecks ?? 0) >= 1) {
    run.context.logger.info(
      MODULE_NAME,
      `Lane ${laneId} ends: page queue was empty on two consecutive checks.`,
    );
    return 'completed-lane';
  }
  await sendLane(run, { runId, laneId, emptyChecks: 1 }, EMPTY_QUEUE_RECHECK_SECONDS);
  return 'waiting';
}

/** Runs exportAndLoad for one case. Returns 'rate-limited' on a transient infra error. */
async function syncNextCase(run: LaneRun, page: OpenPage): Promise<'synced' | 'rate-limited'> {
  const { type, caseId } = page.body.events[page.nextIndex];
  const caseStartedAt = Date.now();
  let result: CaseSyncEvent;
  try {
    [result] = await ExportAndLoadCase.exportAndLoad(run.context, [{ type, caseId }]);
  } catch (error) {
    if (!isTransientInfraError(error)) {
      throw error;
    }
    page.transientCount = 1;
    return 'rate-limited';
  }

  run.longestCaseMs = Math.max(run.longestCaseMs ?? 0, Date.now() - caseStartedAt);
  page.results.push(result);
  page.nextIndex += 1;
  run.casesDone += 1;
  if (result.error) {
    run.casesFailed += 1;
  } else if (result.divisionChange === undefined) {
    run.casesWritten += 1;
  }
  return 'synced';
}

async function paceAfterCase(run: LaneRun, page: OpenPage) {
  const sleepMs = computePacingSleepMs(run.casesDone, run.casesPerSec, Date.now() - run.startedAt);
  if (sleepMs > 0) {
    page.msSlept += sleepMs;
    await sleep(sleepMs);
  }
}

async function drainPages(run: LaneRun): Promise<LaneOutcome> {
  const { runId, laneId } = run.message;
  let page: OpenPage | undefined;

  while (true) {
    if (isOutOfBudget(run)) {
      if (page) {
        await endPage(run, page, page.body.events.slice(page.nextIndex), 'escaped');
      }
      await sendLane(run, { runId, laneId });
      return 'escaped';
    }

    if (!page) {
      const receipt = await run.queues.page.receiveMessage(PAGE_LEASE_SECONDS);
      if (!receipt) {
        return handleEmptyPageQueue(run);
      }
      page = {
        receipt,
        body: JSON.parse(receipt.messageText) as ResyncCasesByDatePageMessage,
        startedAt: Date.now(),
        nextIndex: 0,
        results: [],
        msSlept: 0,
        transientCount: 0,
      };
    }

    if (page.nextIndex >= page.body.events.length) {
      await endPage(run, page, [], 'completed');
      page = undefined;
      continue;
    }

    if (isLeaseExpiring(run, page)) {
      await endPage(run, page, page.body.events.slice(page.nextIndex), 'lease-expiring');
      page = undefined;
      continue;
    }

    if ((await syncNextCase(run, page)) === 'rate-limited') {
      await endPage(run, page, page.body.events.slice(page.nextIndex), 'rate-limited');
      await sendLane(run, { runId, laneId }, laneRestartDelaySeconds());
      return 'rate-limited';
    }

    await paceAfterCase(run, page);
  }
}

function completeWriterTrace(run: LaneRun, outcome: LaneOutcome, errorMessage?: string) {
  const { runId, laneId } = run.message;
  completeDataflowTrace(
    run.context.observability,
    run.trace,
    MODULE_NAME,
    'handleWriter',
    run.context.logger,
    {
      documentsWritten: run.casesWritten,
      documentsFailed: run.casesFailed,
      success: outcome !== 'rate-limited' && outcome !== 'error',
      error: outcome === 'rate-limited' ? 'rate-limited-requeued' : errorMessage,
      details: { runId, laneId: String(laneId), outcome },
    },
  );
}

/**
 * One lane writer invocation. Pulls pages from the PAGE queue and syncs them one case at a time
 * until the invocation nears its time budget, a transient infra error stops it, or the page queue
 * stays empty. Each exit re-sends this lane's WRITER message unless the lane has finished.
 */
export async function handleWriter(
  message: ResyncCasesByDateWriterMessage,
  invocationContext: InvocationContext,
) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const startedAt = Date.now();
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);
  const run: LaneRun = {
    context,
    trace,
    message,
    startedAt,
    casesPerSec: readCasesPerSecPerLane(),
    casesDone: 0,
    casesWritten: 0,
    casesFailed: 0,
    queues: {
      page: StorageQueueHumbleObject.fromConnectionString(connectionString, PAGE.queueName),
      writer: StorageQueueHumbleObject.fromConnectionString(connectionString, WRITER.queueName),
      fix: StorageQueueHumbleObject.fromConnectionString(connectionString, FIX.queueName),
      dlq: StorageQueueHumbleObject.fromConnectionString(connectionString, DLQ.queueName),
    },
  };

  let outcome: LaneOutcome;
  try {
    outcome = await drainPages(run);
  } catch (error) {
    context.logger.error(MODULE_NAME, `handleWriter failed: ${(error as Error).message}`);
    completeWriterTrace(run, 'error', (error as Error).message);
    throw error;
  }
  completeWriterTrace(run, outcome);
}

export async function handleError(
  event: CaseSyncEvent | QueueError,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  if (isQueueError(event)) {
    logger.error(
      MODULE_NAME,
      `Queue error from ${event.module} ${event.activityName}: ${event.error.message}`,
    );
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleError', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: false,
      details: { disposition: 'job-failure' },
    });
    return;
  }

  const abandoned = isNotFoundError(event.error);

  if (abandoned) {
    logger.info(
      MODULE_NAME,
      `Abandoning attempt to sync ${event.caseId}: ${event.error?.['message']}`,
    );
  } else {
    logger.info(
      MODULE_NAME,
      `Error encountered attempting to sync ${event.caseId}: ${event.error?.['message']}`,
    );
    delete event.error;
    invocationContext.extraOutputs.set(RETRY, [event]);
  }

  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleError', logger, {
    documentsWritten: 0,
    documentsFailed: 1,
    success: true,
    details: { disposition: abandoned ? 'abandoned' : 'queued-for-retry' },
  });
}

export async function handleRetry(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const RETRY_LIMIT = 3;
  event.retryCount = (event.retryCount ?? 0) + 1;

  if (event.retryCount > RETRY_LIMIT) {
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    logger.info(MODULE_NAME, `Too many attempts to sync ${event.caseId}`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: true,
      details: { disposition: 'hard-stop', retryCount: String(event.retryCount) },
    });
    return;
  }

  logger.info(MODULE_NAME, `Retry attempt ${event.retryCount} for ${event.caseId}`);

  let processed: CaseSyncEvent;
  try {
    [processed] = await ExportAndLoadCase.exportAndLoad(context, [event]);
  } catch (transientError) {
    if (!isTransientInfraError(transientError)) {
      throw transientError;
    }
    // A transient error on a retry attempt still has budget left under RETRY_LIMIT above, so
    // requeue it with a backoff delay instead of treating it as a final failure: sending it
    // straight to DLQ here would mean the one case of error this whole bug is about (429s) never
    // gets the exponential backoff the fix is meant to provide on this path.
    logger.warn(
      MODULE_NAME,
      `Transient error on retry attempt ${event.retryCount} for ${event.caseId}; requeuing with backoff.`,
    );
    await requeueSingleEventWithBackoff(event, RETRY.queueName, connectionString);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: 'transient-error-requeued',
      details: { disposition: 'retry-requeued', retryCount: String(event.retryCount) },
    });
    return;
  }

  if (processed.error) {
    invocationContext.extraOutputs.set(DLQ, [processed]);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: true,
      details: { disposition: 'retry-failed', retryCount: String(event.retryCount) },
    });
    return;
  }

  if (processed.divisionChange) {
    invocationContext.extraOutputs.set(FIX, [processed.divisionChange]);
    logger.info(MODULE_NAME, `Division change detected on retry for ${event.caseId}`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { disposition: 'division-change-queued', retryCount: String(event.retryCount) },
    });
    return;
  }

  logger.info(MODULE_NAME, `Successfully retried to sync ${event.caseId}`);
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
    documentsWritten: 1,
    documentsFailed: 0,
    success: true,
    details: { disposition: 'retry-succeeded', retryCount: String(event.retryCount) },
  });
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [WRITER, DLQ],
  });

  app.storageQueue(HANDLE_WRITER, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: WRITER.queueName,
    handler: handleWriter,
  });

  app.storageQueue(HANDLE_ERROR, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: DLQ.queueName,
    handler: handleError,
    extraOutputs: [RETRY, HARD_STOP],
  });

  app.storageQueue(HANDLE_RETRY, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: RETRY.queueName,
    handler: handleRetry,
    extraOutputs: [DLQ, HARD_STOP, FIX],
  });
}

export default {
  MODULE_NAME,
  setup,
};
