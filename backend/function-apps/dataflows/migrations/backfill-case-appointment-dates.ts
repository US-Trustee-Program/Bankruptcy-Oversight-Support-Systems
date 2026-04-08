import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  CursorMessage,
  StartMessage,
} from '../dataflows-common';
import BackfillCaseAppointmentDatesUseCase, {
  BackfillAppointment,
} from '../../../lib/use-cases/dataflows/backfill-case-appointment-dates';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_CASE_APPOINTMENT_DATES;
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
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

type BackfillEvent = BackfillAppointment & {
  retryCount?: number;
  error?: Error;
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

  const stateResult = await BackfillCaseAppointmentDatesUseCase.readBackfillState(context);

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
      `Backfill already completed at ${existingState.lastUpdatedAt}. Processed ${existingState.processedCount} appointments. Skipping.`,
    );
    return;
  }

  const lastId = existingState?.lastId ?? null;
  const processedCount = existingState?.processedCount ?? 0;

  if (existingState) {
    logger.info(
      MODULE_NAME,
      `Resuming backfill from cursor ${lastId}. Already processed ${processedCount} appointments.`,
    );
  } else {
    logger.info(MODULE_NAME, 'Starting fresh case appointment date backfill migration.');
  }

  const cursorMessage: CursorMessage = { lastId };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

/**
 * handlePage
 *
 * Process a page of appointments using cursor-based pagination.
 * Fetches page, batch-queries DXTR, writes dates, advances cursor.
 */
async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const stateResult = await BackfillCaseAppointmentDatesUseCase.readBackfillState(context);
  if (stateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  const currentProcessedCount = stateResult.data?.processedCount ?? 0;

  const pageResult = await BackfillCaseAppointmentDatesUseCase.getPageNeedingBackfill(
    context,
    cursor.lastId,
    PAGE_SIZE,
  );

  if (pageResult.error || !pageResult.data) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(
        pageResult.error ??
          new CamsError(MODULE_NAME, { message: 'Unexpected missing data in page result' }),
        MODULE_NAME,
        HANDLE_PAGE,
      ),
    );
    return;
  }

  const { appointments, lastId: newLastId, hasMore } = pageResult.data;

  if (appointments.length === 0) {
    logger.info(MODULE_NAME, `No more appointments to backfill. Migration complete.`);

    await BackfillCaseAppointmentDatesUseCase.updateBackfillState(context, {
      lastId: cursor.lastId,
      processedCount: currentProcessedCount,
      status: 'COMPLETED',
    });
    return;
  }

  logger.debug(
    MODULE_NAME,
    `Processing ${appointments.length} appointments. Cursor: ${cursor.lastId ?? 'start'} -> ${newLastId}.`,
  );

  const backfillResult = await BackfillCaseAppointmentDatesUseCase.backfillAppointmentDates(
    context,
    appointments,
  );

  if (backfillResult.error) {
    await BackfillCaseAppointmentDatesUseCase.updateBackfillState(context, {
      lastId: cursor.lastId,
      processedCount: currentProcessedCount,
      status: 'FAILED',
    });

    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(backfillResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  const results = backfillResult.data ?? [];
  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);
  const newProcessedCount = currentProcessedCount + successCount;

  const updateResult = await BackfillCaseAppointmentDatesUseCase.updateBackfillState(context, {
    lastId: newLastId,
    processedCount: newProcessedCount,
    status: hasMore ? 'IN_PROGRESS' : 'COMPLETED',
  });

  if (updateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(updateResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  if (failedResults.length > 0) {
    logger.warn(MODULE_NAME, `${failedResults.length} appointments failed to backfill.`);
    const failedEvents: BackfillEvent[] = failedResults.map((r) => {
      const original = appointments.find((a) => a.caseId === r.caseId);
      return {
        _id: original?._id ?? '',
        caseId: r.caseId,
        trusteeId: original?.trusteeId ?? '',
        error: new Error(r.error ?? 'Unknown error'),
      };
    });
    invocationContext.extraOutputs.set(DLQ, failedEvents);
  }

  logger.debug(
    MODULE_NAME,
    `Successfully backfilled ${successCount} appointments. Total processed: ${newProcessedCount}.`,
  );

  if (hasMore) {
    const nextCursor: CursorMessage = { lastId: newLastId };
    invocationContext.extraOutputs.set(PAGE, nextCursor);
  } else {
    logger.info(
      MODULE_NAME,
      `Backfill migration complete. Total processed: ${newProcessedCount} appointments.`,
    );
  }
}

/**
 * handleError
 *
 * Route failed events to retry queue.
 */
async function handleError(event: BackfillEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  logger.error(
    MODULE_NAME,
    `Error encountered backfilling appointment for case ${event.caseId}: ${event.error?.message ?? 'Unknown error'}.`,
  );

  delete event.error;
  invocationContext.extraOutputs.set(RETRY, [event]);
}

/**
 * handleRetry
 *
 * Retry backfilling a single appointment with retry limit tracking.
 */
async function handleRetry(event: BackfillEvent, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const RETRY_LIMIT = 3;
  if (!event.retryCount) {
    event.retryCount = 1;
  } else {
    event.retryCount += 1;
  }

  if (event.retryCount > RETRY_LIMIT) {
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    logger.error(MODULE_NAME, `Too many retry attempts for case ${event.caseId}.`);
    return;
  }

  const appointment: BackfillAppointment = {
    _id: event._id,
    caseId: event.caseId,
    trusteeId: event.trusteeId,
  };

  const result = await BackfillCaseAppointmentDatesUseCase.backfillAppointmentDates(context, [
    appointment,
  ]);

  if (result.error || result.data?.[0]?.success === false) {
    event.error = result.error ?? new Error(result.data?.[0]?.error ?? 'Unknown error');
    invocationContext.extraOutputs.set(DLQ, [event]);
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

  app.http(HTTP_TRIGGER, {
    route: 'backfill-case-appointment-dates',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export default {
  MODULE_NAME,
  setup,
};
