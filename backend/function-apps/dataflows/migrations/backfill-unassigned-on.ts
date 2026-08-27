import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  CursorMessage,
  StartMessage,
} from '../dataflows-common';
import BackfillUnassignedOnUseCase, {
  BackfillAppointment,
} from '../../../lib/use-cases/dataflows/backfill-unassigned-on';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_UNASSIGNED_ON;
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
type BackfillRetryMessage = BackfillAppointment & {
  retryCount?: number;
  lastErrorMessage?: string;
};

/**
 * Starts a fresh scan for soft-closed appointments needing an unassignedOn correction. No
 * progress state is persisted across runs — the correction is idempotent (correctUnassignedOn is
 * a no-op for an already-correct record), so re-running the whole migration is always safe and
 * simply re-scans from the beginning.
 */
async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  logger.info(MODULE_NAME, 'Starting unassignedOn backfill migration.');

  const cursorMessage: CursorMessage = { lastId: null };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

/**
 * Processes a page of closed appointments using cursor-based pagination. Delegates all business
 * logic to processBackfillPage; handles queue I/O only.
 */
async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await BackfillUnassignedOnUseCase.processBackfillPage(
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
    logger.info(MODULE_NAME, `No more appointments to backfill. Migration complete.`);
    return;
  }

  const { appointments, failedResults, successCount, newLastId, nextCursor } = result;

  logger.debug(
    MODULE_NAME,
    `Processing ${appointments.length} appointments. Cursor: ${cursor.lastId ?? 'start'} -> ${newLastId}.`,
  );

  if (failedResults.length > 0) {
    logger.warn(MODULE_NAME, `${failedResults.length} appointments failed to backfill.`);
    const failedEvents: BackfillRetryMessage[] = failedResults.map((r) => {
      const original = appointments.find((a) => a.caseId === r.caseId)!;
      return { ...original, lastErrorMessage: r.error ?? 'Unknown error' };
    });
    invocationContext.extraOutputs.set(DLQ, failedEvents);
  }

  logger.debug(MODULE_NAME, `Successfully backfilled ${successCount} appointments this page.`);

  if (nextCursor) {
    invocationContext.extraOutputs.set(PAGE, nextCursor);
  } else {
    logger.info(MODULE_NAME, `Backfill migration complete.`);
  }
}

/**
 * Routes failed events to the retry queue.
 */
async function handleError(event: BackfillRetryMessage, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  logger.error(
    MODULE_NAME,
    `Error encountered backfilling appointment for case ${event.caseId}: ${event.lastErrorMessage ?? 'Unknown error'}.`,
  );

  invocationContext.extraOutputs.set(RETRY, [event]);
}

/**
 * Retries backfilling a single appointment with retry limit tracking.
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

  const { retryCount: _r, lastErrorMessage: _e, ...appointment } = event;
  const updatedEvent: BackfillRetryMessage = { ...appointment, retryCount };

  const result = await BackfillUnassignedOnUseCase.correctUnassignedOn(context, [appointment]);

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
