import { app, InvocationContext, output } from '@azure/functions';
import { QueueServiceClient, RestError } from '@azure/storage-queue';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildContainerName,
  buildFunctionName,
  buildQueueName,
  CursorMessage,
  ensureContainersExist,
  StartMessage,
} from '../dataflows-common';
import MigrateTrusteesUseCase from '../../../lib/use-cases/dataflows/migrate-trustees';
import * as MigrationStateService from '../../../lib/use-cases/dataflows/trustee-migration-state.service';
import { buildQueueError, QueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';
import { TrusteeMigrationStartEvent } from '@common/cams/dataflow-events';
import factory from '../../../lib/factory';

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

const FAILED_APPOINTMENTS = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'failed-appointments'),
  connection: 'AzureWebJobsStorage',
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_ERROR = buildFunctionName(MODULE_NAME, 'handleError');

export type MigrationStartMessage = StartMessage &
  TrusteeMigrationStartEvent & {
    flushQueues?: boolean;
  };

// Drains all messages from a named queue and writes them to a single JSONL blob.
// Deletes each message after reading so the queue is truly drained.
// All messages are accumulated in memory before writing — one file per flush.
async function dumpQueueToBlob(
  objectStorage: ReturnType<typeof factory.getObjectStorageGateway>,
  logger: { info: (module: string, msg: string) => void },
  queueName: string,
  blobName: string,
  outputContainerName: string,
): Promise<number> {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    logger.info(MODULE_NAME, `flushQueues: AzureWebJobsStorage not set — skipping ${queueName}`);
    return 0;
  }
  const queueClient =
    QueueServiceClient.fromConnectionString(connectionString).getQueueClient(queueName);

  const lines: string[] = [];

  try {
    let response = await queueClient.receiveMessages({ numberOfMessages: 32 });
    while (response.receivedMessageItems.length > 0) {
      for (const msg of response.receivedMessageItems) {
        lines.push(Buffer.from(msg.messageText, 'base64').toString('utf-8'));
        await queueClient.deleteMessage(msg.messageId, msg.popReceipt);
      }
      response = await queueClient.receiveMessages({ numberOfMessages: 32 });
    }
  } catch (err) {
    // Queues are created lazily by their output binding on first use — a queue
    // that has never received a message (e.g. DLQ or FAILED_APPOINTMENTS before
    // any failure has occurred) won't exist yet. Treat that as empty rather than
    // aborting the whole flush and poison-queuing the flushQueues start message.
    if (err instanceof RestError && err.statusCode === 404) {
      logger.info(MODULE_NAME, `flushQueues: ${queueName} does not exist — skipping`);
      return 0;
    }
    throw err;
  }

  if (lines.length === 0) {
    logger.info(MODULE_NAME, `flushQueues: ${queueName} is empty — no blob written`);
    return 0;
  }

  await objectStorage.writeObject(outputContainerName, blobName, lines.join('\n'));
  logger.info(
    MODULE_NAME,
    `flushQueues: wrote ${lines.length} messages to ${outputContainerName}/${blobName}`,
  );
  return lines.length;
}

function requiresDeleteAll(start: MigrationStartMessage): boolean {
  return !!start.deleteAll;
}

/**
 * handleStart
 *
 * Initialize the trustee migration by reading existing state for resumability.
 * If already completed, skip. Otherwise, queue first/next CursorMessage with lastTrusteeId from state.
 * If deleteAll flag is present, delete all existing trustees and appointments before starting.
 * If flushQueues flag is present, dump all queues to blob storage and return.
 */
export async function handleStart(
  start: MigrationStartMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new MigrateTrusteesUseCase(context);

    if (start.flushQueues) {
      logger.info(MODULE_NAME, 'flushQueues flag detected — dumping queues to blob storage.');
      const objectStorage = factory.getObjectStorageGateway(context);
      const outputContainerName = buildContainerName(MODULE_NAME, 'out');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const startFlushed = await dumpQueueToBlob(
        objectStorage,
        logger,
        START.queueName,
        `flush-start-${timestamp}.jsonl`,
        outputContainerName,
      );
      const pageFlushed = await dumpQueueToBlob(
        objectStorage,
        logger,
        PAGE.queueName,
        `flush-page-${timestamp}.jsonl`,
        outputContainerName,
      );
      const dlqFlushed = await dumpQueueToBlob(
        objectStorage,
        logger,
        DLQ.queueName,
        `flush-dlq-${timestamp}.jsonl`,
        outputContainerName,
      );
      const failedAppointmentsFlushed = await dumpQueueToBlob(
        objectStorage,
        logger,
        FAILED_APPOINTMENTS.queueName,
        `flush-failed-appointments-${timestamp}.jsonl`,
        outputContainerName,
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: startFlushed + pageFlushed + dlqFlushed + failedAppointmentsFlushed,
        documentsFailed: 0,
        success: true,
        details: {
          mode: 'flushQueues',
          startFlushed: String(startFlushed),
          pageFlushed: String(pageFlushed),
          dlqFlushed: String(dlqFlushed),
          failedAppointmentsFlushed: String(failedAppointmentsFlushed),
        },
      });
      return;
    }

    if (requiresDeleteAll(start)) {
      logger.info(
        MODULE_NAME,
        'deleteAll flag detected. Deleting all existing trustees and appointments.',
      );

      const deleteResult = await useCase.deleteAllTrusteesAndAppointments();
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

      const { deletedTrustees, deletedAppointments, deletedProfessionalIds } = deleteResult.data;
      logger.info(
        MODULE_NAME,
        `Successfully deleted ${deletedTrustees} trustees, ${deletedAppointments} appointments, and ${deletedProfessionalIds} professional ID mappings.`,
      );

      const resetResult = await MigrationStateService.resetMigrationState(context);
      if (resetResult.error) {
        invocationContext.extraOutputs.set(
          DLQ,
          buildQueueError(resetResult.error, MODULE_NAME, HANDLE_START),
        );
        completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
          documentsWritten: 0,
          documentsFailed: 0,
          success: false,
          error: resetResult.error.message,
        });
        return;
      }
    }

    const stateResult = await MigrationStateService.getOrCreateMigrationState(
      context,
      !!(start.reset || start.deleteAll),
    );

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

    if (existingState?.status === 'COMPLETED') {
      logger.info(
        MODULE_NAME,
        `Migration already completed at ${existingState.lastUpdatedAt}. Processed ${existingState.processedCount} trustees with ${existingState.appointmentsProcessedCount} appointments. Skipping.`,
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { disposition: 'already-completed' },
      });
      return;
    }

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

    const cursorMessage: CursorMessage = {
      lastId: lastTrusteeId?.toString() ?? null,
      importAll: start.importAll ?? true,
    };
    invocationContext.extraOutputs.set(PAGE, cursorMessage);

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: existingState ? 'resume' : 'fresh-start' },
    });
  } catch (err) {
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
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
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new MigrateTrusteesUseCase(context);

    const stateResult = await MigrationStateService.getOrCreateMigrationState(context);
    if (stateResult.error) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(stateResult.error, MODULE_NAME, HANDLE_PAGE),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: stateResult.error.message,
      });
      return;
    }

    const currentState = stateResult.data;
    const currentProcessedCount = currentState.processedCount ?? 0;
    const currentAppointmentsCount = currentState.appointmentsProcessedCount ?? 0;
    const currentAmbiguousCount = currentState.ambiguousCount ?? 0;
    const currentErrors = currentState.errors ?? 0;

    const pageResult = await useCase.getPageOfTrustees(
      cursor.lastId ? Number.parseInt(cursor.lastId) : null,
      PAGE_SIZE,
      cursor.importAll,
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
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: pageResult.error?.message ?? 'Unexpected missing data in page result',
      });
      return;
    }

    const { trustees, hasMore } = pageResult.data;

    if (trustees.length === 0) {
      // No more trustees to process - mark as completed
      logger.info(MODULE_NAME, `No more trustees to migrate. Migration complete.`);
      await MigrationStateService.completeMigration(context, currentState);
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { disposition: 'complete' },
      });
      return;
    }

    const lastTrusteeId = trustees.at(-1).ID;

    logger.debug(
      MODULE_NAME,
      `Processing ${trustees.length} trustees. Cursor: ${cursor.lastId ?? 'start'} -> ${lastTrusteeId}.`,
    );

    // Process page with retry logic handled in use case
    const processResult = await useCase.processPageOfTrustees(
      trustees,
      buildContainerName(MODULE_NAME, 'out'),
    );

    if (processResult.error) {
      await MigrationStateService.failMigration(context, currentState, processResult.error.message);

      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(processResult.error, MODULE_NAME, HANDLE_PAGE),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: processResult.error.message,
      });
      return;
    }

    const { processed, appointments, errors, ambiguousCount, failedAppointments } =
      processResult.data;

    const newProcessedCount = currentProcessedCount + processed;
    const newAppointmentsCount = currentAppointmentsCount + appointments;
    const newAmbiguousCount = currentAmbiguousCount + ambiguousCount;
    const newErrors = currentErrors + errors;

    // Send failed appointments to FAILED_APPOINTMENTS queue for visibility and review
    if (failedAppointments && failedAppointments.length > 0) {
      // Collect all failed appointment messages
      const failedAppointmentMessages = failedAppointments.map((failedAppt) => ({
        type: 'FAILED_APPOINTMENT',
        classification: failedAppt.classification,
        notes: failedAppt.notes,
        mapType: failedAppt.mapType,
        timestamp: failedAppt.timestamp,
        atsAppointment: {
          TRU_ID: failedAppt.atsAppointment.TRU_ID,
          DISTRICT: failedAppt.atsAppointment.DISTRICT,
          STATE: failedAppt.atsAppointment.STATE,
          CHAPTER: failedAppt.atsAppointment.CHAPTER,
          STATUS: failedAppt.atsAppointment.STATUS,
          // Convert Date objects to ISO strings for queue serialization
          DATE_APPOINTED: failedAppt.atsAppointment.DATE_APPOINTED?.toISOString() ?? null,
          EFFECTIVE_DATE: failedAppt.atsAppointment.EFFECTIVE_DATE?.toISOString() ?? null,
        },
      }));

      // Send all messages at once (Azure Functions accepts array)
      invocationContext.extraOutputs.set(FAILED_APPOINTMENTS, failedAppointmentMessages);

      logger.info(
        MODULE_NAME,
        `Sent ${failedAppointments.length} failed appointments to failed-appointments queue for review`,
      );
    }

    const updateResult = await MigrationStateService.updateMigrationState(context, {
      ...currentState,
      lastTrusteeId,
      processedCount: newProcessedCount,
      appointmentsProcessedCount: newAppointmentsCount,
      ambiguousCount: newAmbiguousCount,
      errors: newErrors,
      status: hasMore ? 'IN_PROGRESS' : 'COMPLETED',
    });

    if (updateResult.error) {
      invocationContext.extraOutputs.set(
        DLQ,
        buildQueueError(updateResult.error, MODULE_NAME, HANDLE_PAGE),
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: updateResult.error.message,
      });
      return;
    }

    if (errors > 0) {
      // Failed trustees are already logged in the use case
      logger.warn(MODULE_NAME, `${errors} trustees failed to migrate in this batch.`);
    }

    logger.debug(
      MODULE_NAME,
      `Successfully migrated ${processed} trustees with ${appointments} appointments. Total processed: ${newProcessedCount}.`,
    );

    if (hasMore) {
      const nextCursor: CursorMessage = {
        lastId: lastTrusteeId.toString() ?? null,
        ...(cursor.importAll !== undefined && { importAll: cursor.importAll }),
      };
      invocationContext.extraOutputs.set(PAGE, nextCursor);
    } else {
      logger.info(
        MODULE_NAME,
        `Trustee migration complete. Total processed: ${newProcessedCount} trustees with ${newAppointmentsCount} appointments. Ambiguous-flag trustees requiring manual review: ${newAmbiguousCount}.`,
      );
    }

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: processed,
      documentsFailed: errors,
      success: true,
      details: {
        trustees: String(newProcessedCount),
        appointments: String(newAppointmentsCount),
        ambiguous: String(newAmbiguousCount),
      },
    });
  } catch (err) {
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * handleError
 *
 * Handle infrastructure failures by logging to DLQ.
 * Individual trustee failures are now handled with retry logic in the use case.
 */
async function handleError(event: QueueError, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  // Log infrastructure failure
  const queueError = event as QueueError;
  logger.error(
    MODULE_NAME,
    `Infrastructure error in ${queueError.activityName}: ${queueError.error?.message ?? 'Unknown error'}. Logged to DLQ for manual review.`,
  );

  // Error already in DLQ (this handler processes DLQ messages)
  // Just log for visibility - no further action needed
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleError', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: {
      activityName: queueError.activityName,
      ...(queueError.error?.message && { errorMessage: queueError.error.message }),
    },
  });
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
    extraOutputs: [PAGE, DLQ, FAILED_APPOINTMENTS],
  });

  app.storageQueue(HANDLE_ERROR, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: DLQ.queueName,
    handler: handleError,
    extraOutputs: [],
  });
}

export default {
  MODULE_NAME,
  setup,
};
