import { app, InvocationContext, output } from '@azure/functions';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import { handleRateLimitRetry } from '../dataflows-rate-limit';
import ResyncRemainingCasesUseCase from '../../../lib/use-cases/dataflows/resync-remaining-cases';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { isNotFoundError } from '../../../lib/common-errors/not-found-error';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { filterToExtendedAscii } from '@common/cams/sanitization';
import { LoggerImpl } from '../../../lib/adapters/services/logger.service';
import { AppInsightsObservability } from '../../../lib/adapters/services/observability';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { FIX_QUEUE_NAME } from './division-change-cleanup';

const MODULE_NAME = 'RESYNC-REMAINING-CASES';
const PAGE_SIZE = 100;

type ResyncRemainingStartMessage = {
  cutoffDate: string;
};

type ResyncRemainingCursorMessage = {
  cutoffDate: string;
  lastId: string | null;
  remainingCount: number;
  retryCount?: number;
};

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
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_ERROR = buildFunctionName(MODULE_NAME, 'handleError');
const HANDLE_RETRY = buildFunctionName(MODULE_NAME, 'handleRetry');

async function handleStart(
  message: ResyncRemainingStartMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const cutoffDate = message.cutoffDate;
  if (!cutoffDate) {
    logger.error(MODULE_NAME, 'cutoffDate is required in the start message.');
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      details: { reason: 'missing cutoffDate' },
    });
    return;
  }

  logger.info(MODULE_NAME, `Starting resync of remaining cases with cutoffDate: ${cutoffDate}`);

  const cursorMessage: ResyncRemainingCursorMessage = {
    lastId: null,
    cutoffDate,
    remainingCount: 0,
  };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: { cutoffDate },
  });
}

export async function handlePage(
  cursor: ResyncRemainingCursorMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const result = await ResyncRemainingCasesUseCase.getPageOfRemainingCasesByCursor(
    context,
    cursor.cutoffDate,
    cursor.lastId,
    PAGE_SIZE,
  );

  if (result.error || !result.data) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error: result.error,
      message: cursor,
      checkQueueName: PAGE.queueName,
      dlqOutput: DLQ,
      invocationContext,
      context,
      moduleName: MODULE_NAME,
      activityName: 'handlePage',
    });

    if (rateLimitRetryStatus === 'retried') {
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: 'rate-limited-requeued',
      });
      return;
    }

    if (rateLimitRetryStatus === 'exhausted') {
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 1,
        success: false,
        error: 'rate-limit-retry-exhausted',
      });
      return;
    }

    const nonTransientError: CamsError =
      result.error ??
      new CamsError(MODULE_NAME, {
        message: 'Failed to get page of remaining cases: no data returned.',
      });
    logger.error(
      MODULE_NAME,
      `Failed to get page of remaining cases: ${nonTransientError.message}`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: nonTransientError.message,
    });
    throw nonTransientError;
  }

  const { caseIds, lastId: newLastId, hasMore } = result.data;

  if (caseIds.length === 0) {
    logger.info(
      MODULE_NAME,
      `REMAINING_CASES_TOTAL=${cursor.remainingCount} — No more remaining cases to resync. Migration complete.`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { reason: 'no more cases' },
    });
    return;
  }

  const remainingCount = cursor.remainingCount + caseIds.length;

  logger.info(
    MODULE_NAME,
    `Processing ${caseIds.length} remaining cases (running total: ${remainingCount}). Cursor: ${cursor.lastId ?? 'start'} -> ${newLastId}.`,
  );

  const events: CaseSyncEvent[] = caseIds.map((caseId) => ({
    type: 'MIGRATION',
    caseId,
  }));

  const processedEvents = await ExportAndLoadCase.exportAndLoad(context, events);

  const divisionChanges = processedEvents
    .filter((event) => event.divisionChange !== undefined)
    .map((event) => event.divisionChange!);

  if (divisionChanges.length > 0) {
    invocationContext.extraOutputs.set(FIX, divisionChanges);
    logger.info(MODULE_NAME, `Queued ${divisionChanges.length} division changes to FIX`);
  }

  const failedEvents = processedEvents.filter((event) => !!event.error);
  if (failedEvents.length > 0) {
    logger.warn(MODULE_NAME, `${failedEvents.length} events failed, sending to DLQ`);
    invocationContext.extraOutputs.set(DLQ, failedEvents);
  }

  if (hasMore) {
    const nextCursor: ResyncRemainingCursorMessage = {
      lastId: newLastId,
      cutoffDate: cursor.cutoffDate,
      remainingCount,
    };
    invocationContext.extraOutputs.set(PAGE, nextCursor);
  } else {
    const successCount = processedEvents.length - failedEvents.length - divisionChanges.length;
    logger.info(
      MODULE_NAME,
      `REMAINING_CASES_TOTAL=${remainingCount} — Resync complete. ${successCount} succeeded, ${failedEvents.length} failed, ${divisionChanges.length} division changes queued.`,
    );
  }

  const successCount = processedEvents.length - failedEvents.length - divisionChanges.length;
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
    documentsWritten: successCount,
    documentsFailed: failedEvents.length,
    success: true,
    details: {
      totalCases: String(caseIds.length),
      divisionChangesQueued: String(divisionChanges.length),
    },
  });
}

function routeErrorForInitialAttempt(
  event: CaseSyncEvent,
  invocationContext: InvocationContext,
  logger: LoggerImpl,
): void {
  if (isNotFoundError(event.error)) {
    logger.info(MODULE_NAME, `Abandoning attempt to sync ${event.caseId}: ${event.error.message}`);
    return;
  }

  logger.info(
    MODULE_NAME,
    `Error encountered attempting to sync ${event.caseId}: ${event.error['message']}`,
  );
  delete event.error;
  invocationContext.extraOutputs.set(RETRY, [event]);
}

async function handleError(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);
  const observability = new AppInsightsObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  const abandoned = isNotFoundError(event.error);
  routeErrorForInitialAttempt(event, invocationContext, logger);
  completeDataflowTrace(observability, trace, MODULE_NAME, 'handleError', logger, {
    documentsWritten: 0,
    documentsFailed: 1,
    success: true,
    details: { disposition: abandoned ? 'abandoned' : 'queued-for-retry' },
  });
}

function incrementRetryCount(
  event: CaseSyncEvent,
  limit: number,
  invocationContext: InvocationContext,
  logger: LoggerImpl,
): boolean {
  event.retryCount = (event.retryCount ?? 0) + 1;

  if (event.retryCount > limit) {
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    logger.info(MODULE_NAME, `Too many attempts to sync ${filterToExtendedAscii(event.caseId)}`);
    return true;
  }
  return false;
}

async function handleRetry(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const RETRY_LIMIT = 3;
  const shouldStop = incrementRetryCount(event, RETRY_LIMIT, invocationContext, logger);
  if (shouldStop) {
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: true,
      details: { disposition: 'hard-stop', retryCount: String(event.retryCount) },
    });
    return;
  }

  logger.info(
    MODULE_NAME,
    `Retry attempt ${event.retryCount} for ${filterToExtendedAscii(event.caseId)}`,
  );

  const [processed] = await ExportAndLoadCase.exportAndLoad(context, [event]);

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
    logger.info(
      MODULE_NAME,
      `Division change detected on retry for ${filterToExtendedAscii(event.caseId)}`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { disposition: 'division-change-queued', retryCount: String(event.retryCount) },
    });
    return;
  }

  logger.info(MODULE_NAME, `Successfully retried to sync ${filterToExtendedAscii(event.caseId)}`);
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
    extraOutputs: [PAGE],
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: PAGE.queueName,
    handler: handlePage,
    extraOutputs: [PAGE, DLQ, FIX],
  });

  app.storageQueue(HANDLE_ERROR, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: DLQ.queueName,
    handler: handleError,
    extraOutputs: [RETRY],
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
