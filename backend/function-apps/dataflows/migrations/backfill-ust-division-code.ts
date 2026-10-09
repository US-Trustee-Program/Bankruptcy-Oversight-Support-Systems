import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  CursorMessage,
  StartMessage,
} from '../dataflows-common';
import BackfillUstDivisionCodeUseCase, {
  BackfillCase,
} from '../../../lib/use-cases/dataflows/backfill-ust-division-code';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_UST_DIVISION_CODE;
const PAGE_SIZE = 100;

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

const RETRY = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'retry'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HARD_STOP = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'hard-stop'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_ERROR = buildFunctionName(MODULE_NAME, 'handleError');
const HANDLE_RETRY = buildFunctionName(MODULE_NAME, 'handleRetry');

// Error objects don't serialize reliably over storage queues; use lastErrorMessage instead.
type BackfillRetryMessage = BackfillCase & {
  retryCount?: number;
  lastErrorMessage?: string;
};

/**
 * handleStart
 *
 * Initialize the backfill migration by reading existing state for resumability.
 * If already completed, skip. Otherwise, queue first/next CursorMessage with lastId from state.
 */
async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const stateResult = await BackfillUstDivisionCodeUseCase.readBackfillState(context);

  if (stateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateResult.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  const existingState = stateResult.data;

  if (existingState?.status === 'COMPLETED') {
    logger.info(
      MODULE_NAME,
      `Backfill already completed at ${existingState.lastUpdatedAt}. Processed ${existingState.processedCount} cases. Skipping.`,
    );
    return;
  }

  const lastId = existingState?.lastId ?? null;
  const processedCount = existingState?.processedCount ?? 0;

  logger.info(
    MODULE_NAME,
    existingState
      ? `Resuming backfill from cursor ${lastId}. Already processed ${processedCount} cases.`
      : 'Starting fresh ustDivisionCode backfill migration (Eastern District of TN only).',
  );

  const stateUpdateResult = await BackfillUstDivisionCodeUseCase.updateBackfillState(
    context,
    { lastId, processedCount, status: 'IN_PROGRESS' },
    existingState,
  );
  if (stateUpdateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateUpdateResult.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  const cursorMessage: CursorMessage = { lastId };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

/**
 * handlePage
 *
 * Process a page of cases using cursor-based pagination.
 * Delegates all business logic to processBackfillPage; handles queue I/O only.
 */
async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await BackfillUstDivisionCodeUseCase.processBackfillPage(
    context,
    cursor.lastId,
    PAGE_SIZE,
  );

  if (result.status === 'error') {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  if (result.status === 'empty') {
    logger.info(MODULE_NAME, `No more cases to backfill. Migration complete.`);
    return;
  }

  const { cases, failedResults, successCount, processedCount, nextCursor } = result;

  logger.debug(
    MODULE_NAME,
    `Processing ${cases.length} cases. Cursor: ${cursor.lastId ?? 'start'}.`,
  );

  if (failedResults.length > 0) {
    logger.warn(MODULE_NAME, `${failedResults.length} cases failed to backfill.`);
    const failedEvents: BackfillRetryMessage[] = failedResults.map((r) => {
      const original = cases.find((c) => c.caseId === r.caseId)!;
      return { ...original, lastErrorMessage: r.error ?? 'Unknown error' };
    });
    invocationContext.extraOutputs.set(DLQ, failedEvents);
  }

  logger.debug(
    MODULE_NAME,
    `Successfully backfilled ${successCount} cases. Total processed: ${processedCount}.`,
  );

  if (nextCursor) {
    invocationContext.extraOutputs.set(PAGE, nextCursor);
  } else {
    logger.info(
      MODULE_NAME,
      `Backfill migration complete. Total processed: ${processedCount} cases.`,
    );
  }
}

/**
 * handleError
 *
 * Route failed events to retry queue.
 */
async function handleError(event: BackfillRetryMessage, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  logger.error(
    MODULE_NAME,
    `Error encountered backfilling ustDivisionCode for case ${event.caseId}: ${event.lastErrorMessage ?? 'Unknown error'}.`,
  );

  invocationContext.extraOutputs.set(RETRY, [event]);
}

/**
 * handleRetry
 *
 * Retry backfilling a single case with retry limit tracking.
 */
async function handleRetry(event: BackfillRetryMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const RETRY_LIMIT = 3;
  const retryCount = (event.retryCount ?? 0) + 1;

  if (retryCount > RETRY_LIMIT) {
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    logger.error(MODULE_NAME, `Too many retry attempts for case ${event.caseId}.`);
    return;
  }

  const { retryCount: _r, lastErrorMessage: _e, ...bCase } = event;
  const updatedEvent: BackfillRetryMessage = { ...bCase, retryCount };

  const result = await BackfillUstDivisionCodeUseCase.backfillUstDivisionCodes(context, [bCase]);

  if (result.error || result.data?.[0]?.success === false) {
    const lastErrorMessage = result.error?.message ?? result.data?.[0]?.error ?? 'Unknown error';
    invocationContext.extraOutputs.set(DLQ, [{ ...updatedEvent, lastErrorMessage }]);
  } else {
    logger.info(MODULE_NAME, `Successfully retried backfill for case ${event.caseId}.`);
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [PAGE, DLQ],
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
