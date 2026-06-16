import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildContainerName,
  buildFunctionName,
  buildQueueName,
  ensureContainersExist,
  StartMessage,
} from '../dataflows-common';
import MigrateCaseAppointmentsUseCase from '../../../lib/use-cases/dataflows/migrate-case-appointments';
import { AcmsCaseAppointmentRecord } from '../../../lib/use-cases/gateways.types';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.MIGRATE_CASE_APPOINTMENTS;
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

export type MigrateCaseAppointmentsStartMessage = StartMessage & {
  reset?: boolean; // Resets the MIGRATE_CASE_APPOINTMENTS_STATE doc in COSMOS for a fresh re-run
  deleteAll?: boolean; // Deletes all CaseAppointment records where source === 'acms'
  flushQueues?: boolean; // Reserved — dumps queues to blob storage (not yet implemented, guard and log)
};

type MigrateCaseAppointmentsPageMessage = { lastId: number | null };

type RetryMessage = AcmsCaseAppointmentRecord & {
  retryCount?: number;
  lastErrorMessage?: string;
};

/**
 * handleStart
 *
 * Initialize the migration by reading existing state for resumability.
 * If already completed, skip. Otherwise queue first/next page cursor with lastId from state.
 */
export async function handleStart(
  message: MigrateCaseAppointmentsStartMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  // 1. flushQueues — not yet implemented, log and return
  if (message.flushQueues) {
    logger.info(
      MODULE_NAME,
      'flushQueues flag detected — queue flushing not yet implemented for this dataflow.',
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'flushQueues-noop' },
    });
    return;
  }

  // 2. deleteAll — delete all source==='acms' appointments before re-running
  if (message.deleteAll) {
    logger.info(MODULE_NAME, 'deleteAll flag detected — deleting all ACMS case appointments.');
    const deleteResult = await MigrateCaseAppointmentsUseCase.deleteAll(context);
    if (deleteResult.error) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(deleteResult.error, MODULE_NAME, HANDLE_START),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: deleteResult.error.message,
      });
      return;
    }
    logger.info(
      MODULE_NAME,
      `deleteAll complete: ${deleteResult.data.deletedCount} ACMS appointments deleted.`,
    );
  }

  const stateResult = await MigrateCaseAppointmentsUseCase.readMigrationState(context);

  if (stateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateResult.error, MODULE_NAME, HANDLE_START),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: stateResult.error.message,
    });
    return;
  }

  const existingState = stateResult.data;

  // When reset is requested, skip the COMPLETED guard and always start fresh
  if (!message.reset && !message.deleteAll && existingState?.status === 'COMPLETED') {
    logger.info(
      MODULE_NAME,
      `Migration already completed at ${existingState.lastUpdatedAt}. Processed ${existingState.processedCount} records. Skipping.`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { reason: 'already-completed' },
    });
    return;
  }

  // When reset or deleteAll is true, start fresh from null regardless of existing state
  const lastId = message.reset || message.deleteAll ? null : (existingState?.lastId ?? null);
  const processedCount =
    message.reset || message.deleteAll ? 0 : (existingState?.processedCount ?? 0);

  logger.info(
    MODULE_NAME,
    message.reset || message.deleteAll
      ? 'Reset requested — starting fresh ACMS CMMAP case appointment migration.'
      : existingState
        ? `Resuming migration from cursor ${lastId}. Already processed ${processedCount} records.`
        : 'Starting fresh ACMS CMMAP case appointment migration.',
  );

  const stateUpdateResult = await MigrateCaseAppointmentsUseCase.updateMigrationState(
    context,
    { lastId, processedCount, status: 'IN_PROGRESS' },
    existingState,
  );
  if (stateUpdateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateUpdateResult.error, MODULE_NAME, HANDLE_START),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: stateUpdateResult.error.message,
    });
    return;
  }

  const pageMessage: MigrateCaseAppointmentsPageMessage = { lastId };
  invocationContext.extraOutputs.set(PAGE, pageMessage);
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: { pageQueued: '1' },
  });
}

/**
 * handlePage
 *
 * Process a page of CMMAP records using cursor-based pagination.
 */
export async function handlePage(
  cursor: MigrateCaseAppointmentsPageMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const result = await MigrateCaseAppointmentsUseCase.processPage(
    context,
    cursor.lastId,
    PAGE_SIZE,
  );

  if (result.status === 'error') {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, HANDLE_PAGE),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: result.error.message,
    });
    return;
  }

  if (result.status === 'empty') {
    logger.info(
      MODULE_NAME,
      'ACMS CMMAP migration complete. No more records to process for this migration run.',
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { reason: 'empty' },
    });
    return;
  }

  if (result.status === 'done') {
    logger.info(
      MODULE_NAME,
      `ACMS CMMAP migration complete. Total processed: ${result.processedCount} records.`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: result.processedCount,
      documentsFailed: 0,
      success: true,
      details: { reason: 'done' },
    });
    return;
  }

  logger.debug(
    MODULE_NAME,
    `Processed ${result.processedCount} records (${result.successCount} created, ${result.failedCount} failed). Next cursor: ${result.nextLastId}.`,
  );

  invocationContext.extraOutputs.set(PAGE, { lastId: result.nextLastId });
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
    documentsWritten: result.successCount,
    documentsFailed: result.failedCount,
    success: true,
    details: { nextLastId: String(result.nextLastId) },
  });
}

/**
 * handleError and handleRetry
 *
 * Note: These functions implement queue-based retry logic but are not currently
 * used by this migration. Individual record failures are written to blob storage
 * for batch review rather than being retried through Azure queues. This approach
 * is more appropriate for one-shot bulk migrations.
 *
 * The infrastructure is kept for consistency with other dataflows and potential
 * future use.
 */

/**
 * handleError
 *
 * Route failed events to retry queue.
 */
export async function handleError(event: RetryMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  logger.error(
    MODULE_NAME,
    `Error migrating CMMAP record id ${event.id}: ${event.lastErrorMessage ?? 'Unknown error'}.`,
  );

  invocationContext.extraOutputs.set(RETRY, [event]);
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleError', logger, {
    documentsWritten: 0,
    documentsFailed: 1,
    success: true,
    details: { disposition: 'retry' },
  });
}

/**
 * handleRetry
 *
 * Retry a failed record with retry limit tracking.
 */
export async function handleRetry(event: RetryMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const RETRY_LIMIT = 3;
  const retryCount = (event.retryCount ?? 0) + 1;

  if (retryCount > RETRY_LIMIT) {
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    logger.error(MODULE_NAME, `Too many retry attempts for CMMAP record id ${event.id}.`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: true,
      details: { disposition: 'hard-stop' },
    });
    return;
  }

  const { retryCount: _r, lastErrorMessage: _e, ...record } = event;
  const updatedEvent: RetryMessage = { ...record, retryCount };

  try {
    const result = await MigrateCaseAppointmentsUseCase.processSingleRecord(context, record);
    if (result.status === 'error') {
      invocationContext.extraOutputs.set(DLQ, [
        { ...updatedEvent, lastErrorMessage: result.error.message },
      ]);
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
        documentsWritten: 0,
        documentsFailed: 1,
        success: true,
        details: { disposition: 'retry-failed' },
      });
    } else {
      logger.info(MODULE_NAME, `Successfully retried CMMAP record id ${record.id}.`);
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
        documentsWritten: 1,
        documentsFailed: 0,
        success: true,
        details: { disposition: 'retry-succeeded' },
      });
    }
  } catch (originalError) {
    const lastErrorMessage =
      originalError instanceof Error ? originalError.message : String(originalError);
    invocationContext.extraOutputs.set(DLQ, [{ ...updatedEvent, lastErrorMessage }]);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: true,
      details: { disposition: 'retry-failed' },
    });
  }
}

function setup() {
  ensureContainersExist([buildContainerName(MODULE_NAME, 'out')], MODULE_NAME);

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
