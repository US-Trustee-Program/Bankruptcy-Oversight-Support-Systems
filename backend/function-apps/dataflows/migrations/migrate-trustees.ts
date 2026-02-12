import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  CursorMessage,
  StartMessage,
} from '../dataflows-common';
import * as MigrateTrusteesUseCase from '../../../lib/use-cases/dataflows/migrate-trustees';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';
import ModuleNames from '../module-names';
import { AtsTrusteeRecord } from '../../../lib/adapters/types/ats.types';

const MODULE_NAME = ModuleNames.MIGRATE_TRUSTEES;
const PAGE_SIZE = 50; // Smaller page size for trustees with appointments

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: 'AzureWebJobsStorage',
});

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: 'AzureWebJobsStorage',
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: 'AzureWebJobsStorage',
});

const RETRY = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'retry'),
  connection: 'AzureWebJobsStorage',
});

const HARD_STOP = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'hard-stop'),
  connection: 'AzureWebJobsStorage',
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_ERROR = buildFunctionName(MODULE_NAME, 'handleError');
const HANDLE_RETRY = buildFunctionName(MODULE_NAME, 'handleRetry');
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

type TrusteeEvent = AtsTrusteeRecord & {
  retryCount?: number;
  error?: Error;
};

/**
 * handleStart
 *
 * Initialize the trustee migration by reading existing state for resumability.
 * If already completed, skip. Otherwise, queue first/next CursorMessage with lastTrusteeId from state.
 */
async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const stateResult = await MigrateTrusteesUseCase.getOrCreateMigrationState(context);

  if (stateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateResult.error, MODULE_NAME, HANDLE_START),
    );
    return;
  }

  const existingState = stateResult.data;

  // If already completed, skip
  if (existingState?.status === 'COMPLETED') {
    logger.info(
      MODULE_NAME,
      `Migration already completed at ${existingState.lastUpdatedAt}. Processed ${existingState.processedCount} trustees with ${existingState.appointmentsProcessedCount} appointments. Skipping.`,
    );
    return;
  }

  // Resume from existing state or start fresh
  const lastTrusteeId = existingState?.lastTrusteeId ?? null;
  const processedCount = existingState?.processedCount ?? 0;
  const appointmentsProcessedCount = existingState?.appointmentsProcessedCount ?? 0;

  if (existingState && existingState.status === 'IN_PROGRESS') {
    logger.info(
      MODULE_NAME,
      `Resuming migration from trustee ID ${lastTrusteeId}. Already processed ${processedCount} trustees with ${appointmentsProcessedCount} appointments.`,
    );
  } else {
    logger.info(MODULE_NAME, 'Starting fresh trustee migration from ATS.');
  }

  // Queue the first/next cursor message
  const cursorMessage: CursorMessage = { lastId: lastTrusteeId };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

/**
 * handlePage
 *
 * Process a page of trustees using cursor-based pagination.
 * Fetches page using cursor, processes each trustee with their appointments, updates state with new cursor position.
 * If hasMore, queues next CursorMessage. If no more results, sets status to COMPLETED.
 */
async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  // Read current state to get counts
  const stateResult = await MigrateTrusteesUseCase.getOrCreateMigrationState(context);
  if (stateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  const currentState = stateResult.data!;
  const currentProcessedCount = currentState.processedCount ?? 0;
  const currentAppointmentsCount = currentState.appointmentsProcessedCount ?? 0;
  const currentErrors = currentState.errors ?? 0;

  // Fetch page using cursor
  const pageResult = await MigrateTrusteesUseCase.getPageOfTrustees(
    context,
    cursor.lastId as number | null,
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

  const { trustees, hasMore } = pageResult.data;

  if (trustees.length === 0) {
    // No more trustees to process - mark as completed
    logger.info(MODULE_NAME, `No more trustees to migrate. Migration complete.`);

    await MigrateTrusteesUseCase.completeMigration(context, currentState);
    return;
  }

  const lastTrusteeId = trustees[trustees.length - 1].ID;

  logger.debug(
    MODULE_NAME,
    `Processing ${trustees.length} trustees. Cursor: ${cursor.lastId ?? 'start'} -> ${lastTrusteeId}.`,
  );

  // Process the batch
  const processResult = await MigrateTrusteesUseCase.processPageOfTrustees(context, trustees);

  if (processResult.error) {
    // Update state with FAILED status
    await MigrateTrusteesUseCase.failMigration(context, currentState, processResult.error.message);

    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(processResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  const { processed, appointments, errors } = processResult.data!;
  const newProcessedCount = currentProcessedCount + processed;
  const newAppointmentsCount = currentAppointmentsCount + appointments;
  const newErrors = currentErrors + errors;

  // Update state with new cursor position
  const updateResult = await MigrateTrusteesUseCase.updateMigrationState(context, {
    ...currentState,
    lastTrusteeId,
    processedCount: newProcessedCount,
    appointmentsProcessedCount: newAppointmentsCount,
    errors: newErrors,
    status: hasMore ? 'IN_PROGRESS' : 'COMPLETED',
  });

  if (updateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(updateResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  // Handle failed trustees
  if (errors > 0) {
    logger.warn(MODULE_NAME, `${errors} trustees failed to migrate in this batch.`);
    // Failed trustees are already logged in the use case
  }

  logger.debug(
    MODULE_NAME,
    `Successfully migrated ${processed} trustees with ${appointments} appointments. Total processed: ${newProcessedCount}.`,
  );

  // If there are more results, queue next cursor message
  if (hasMore) {
    const nextCursor: CursorMessage = { lastId: lastTrusteeId };
    invocationContext.extraOutputs.set(PAGE, nextCursor);
  } else {
    logger.info(
      MODULE_NAME,
      `Trustee migration complete. Total processed: ${newProcessedCount} trustees with ${newAppointmentsCount} appointments.`,
    );
  }
}

/**
 * handleError
 *
 * Route failed events to retry queue for another attempt.
 */
async function handleError(event: TrusteeEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  logger.error(
    MODULE_NAME,
    `Error encountered migrating trustee ${event.ID}: ${event.error?.message ?? 'Unknown error'}.`,
  );

  delete event.error;
  invocationContext.extraOutputs.set(RETRY, [event]);
}

/**
 * handleRetry
 *
 * Retry migrating a single trustee with retry limit tracking.
 */
async function handleRetry(event: TrusteeEvent, invocationContext: InvocationContext) {
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
    logger.error(MODULE_NAME, `Too many retry attempts for trustee ${event.ID}.`);
    return;
  }

  const result = await MigrateTrusteesUseCase.processTrusteeWithAppointments(context, event);

  if (!result.success) {
    event.error = new Error(result.error ?? 'Unknown error');
    invocationContext.extraOutputs.set(DLQ, [event]);
  } else {
    logger.info(
      MODULE_NAME,
      `Successfully retried migration for trustee ${event.ID} with ${result.appointmentsProcessed} appointments.`,
    );
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
    route: 'migrate-trustees',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export default {
  MODULE_NAME,
  setup,
};
