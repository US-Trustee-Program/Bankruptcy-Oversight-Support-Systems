import { app, InvocationContext, output } from '@azure/functions';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import ResyncRemainingCasesUseCase from '../../../lib/use-cases/dataflows/resync-remaining-cases';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { isNotFoundError } from '../../../lib/common-errors/not-found-error';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';
import { filterToExtendedAscii } from '@common/cams/sanitization';
import { LoggerImpl } from '../../../lib/adapters/services/logger.service';
import { startTrace, completeTrace } from '../../../lib/adapters/services/dataflow-observability';

const MODULE_NAME = 'RESYNC-REMAINING-CASES';
const PAGE_SIZE = 100;

type ResyncRemainingStartMessage = {
  cutoffDate: string;
};

type ResyncRemainingCursorMessage = {
  cutoffDate: string;
  lastId: string | null;
  remainingCount: number;
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
  const trace = startTrace(MODULE_NAME, 'handleStart', invocationContext.invocationId, logger);

  const cutoffDate = message.cutoffDate;
  if (!cutoffDate) {
    logger.error(MODULE_NAME, 'cutoffDate is required in the start message.');
    completeTrace(trace, {
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
  completeTrace(trace, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: { cutoffDate },
  });
}

async function handlePage(
  cursor: ResyncRemainingCursorMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = startTrace(MODULE_NAME, 'handlePage', invocationContext.invocationId, logger);

  const result = await ResyncRemainingCasesUseCase.getPageOfRemainingCasesByCursor(
    context,
    cursor.cutoffDate,
    cursor.lastId,
    PAGE_SIZE,
  );

  if (result.error || !result.data) {
    logger.error(MODULE_NAME, `Failed to get page of remaining cases: ${result.error?.message}`);
    completeTrace(trace, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: result.error?.message,
    });
    throw result.error;
  }

  const { caseIds, lastId: newLastId, hasMore } = result.data;

  if (caseIds.length === 0) {
    logger.info(
      MODULE_NAME,
      `REMAINING_CASES_TOTAL=${cursor.remainingCount} — No more remaining cases to resync. Migration complete.`,
    );
    completeTrace(trace, {
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
    const successCount = processedEvents.length - failedEvents.length;
    logger.info(
      MODULE_NAME,
      `REMAINING_CASES_TOTAL=${remainingCount} — Resync complete. ${successCount} succeeded, ${failedEvents.length} failed.`,
    );
  }

  const successCount = processedEvents.length - failedEvents.length;
  completeTrace(trace, {
    documentsWritten: successCount,
    documentsFailed: failedEvents.length,
    success: true,
    details: { totalCases: String(caseIds.length) },
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
  const trace = startTrace(MODULE_NAME, 'handleError', invocationContext.invocationId, logger);
  const abandoned = isNotFoundError(event.error);
  routeErrorForInitialAttempt(event, invocationContext, logger);
  completeTrace(trace, {
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
  const trace = startTrace(MODULE_NAME, 'handleRetry', invocationContext.invocationId, logger);

  const RETRY_LIMIT = 3;
  const shouldStop = incrementRetryCount(event, RETRY_LIMIT, invocationContext, logger);
  if (shouldStop) {
    completeTrace(trace, {
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
    completeTrace(trace, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: true,
      details: { disposition: 'retry-failed', retryCount: String(event.retryCount) },
    });
    return;
  }

  logger.info(MODULE_NAME, `Successfully retried to sync ${filterToExtendedAscii(event.caseId)}`);
  completeTrace(trace, {
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
    extraOutputs: [PAGE, DLQ],
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
    extraOutputs: [DLQ, HARD_STOP],
  });
}

export default {
  MODULE_NAME,
  setup,
};
