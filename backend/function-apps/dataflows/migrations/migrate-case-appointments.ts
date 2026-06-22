import { app, InvocationContext, output } from '@azure/functions';
import { QueueServiceClient } from '@azure/storage-queue';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildContainerName,
  buildFunctionName,
  buildQueueName,
  ensureContainersExist,
  StartMessage,
} from '../dataflows-common';
import MigrateCaseAppointmentsUseCase from '../../../lib/use-cases/dataflows/migrate-case-appointments';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';
import factory from '../../../lib/factory';

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

const FAILURES = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'failures'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');

export type MigrateCaseAppointmentsStartMessage = StartMessage & {
  reset?: boolean; // Resets the MIGRATE_CASE_APPOINTMENTS_STATE doc in COSMOS for a fresh re-run
  deleteAll?: boolean; // Deletes all CaseAppointment records where source === 'acms'
  flushQueues?: boolean; // Dumps all dataflow queues to JSONL blobs in the output container
};

const OUTPUT_CONTAINER = buildContainerName(MODULE_NAME, 'out');

// Drains all messages from a named queue and writes them as a JSONL blob to the output container.
async function dumpQueueToBlob(
  objectStorage: ReturnType<typeof factory.getObjectStorageGateway>,
  logger: { info: (module: string, msg: string) => void },
  queueName: string,
  blobName: string,
): Promise<number> {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    logger.info(
      MODULE_NAME,
      `flushQueues: AzureWebJobsDataflowsStorage not set — skipping ${queueName}`,
    );
    return 0;
  }
  const queueClient =
    QueueServiceClient.fromConnectionString(connectionString).getQueueClient(queueName);
  const lines: string[] = [];
  let response = await queueClient.receiveMessages({ numberOfMessages: 32 });
  while (response.receivedMessageItems.length > 0) {
    for (const msg of response.receivedMessageItems) {
      const decoded = Buffer.from(msg.messageText, 'base64').toString('utf-8');
      lines.push(decoded);
    }
    response = await queueClient.receiveMessages({ numberOfMessages: 32 });
  }
  if (lines.length > 0) {
    await objectStorage.writeObject(OUTPUT_CONTAINER, blobName, lines.join('\n'));
    logger.info(
      MODULE_NAME,
      `flushQueues: wrote ${lines.length} messages to ${OUTPUT_CONTAINER}/${blobName}`,
    );
  } else {
    logger.info(MODULE_NAME, `flushQueues: ${queueName} is empty — no blob written`);
  }
  return lines.length;
}

type MigrateCaseAppointmentsPageMessage = { lastId: number | null };

/**
 * handleStart
 *
 * Initialize the migration by reading existing state for resumability.
 * If already completed, skip. Otherwise queue first/next page cursor with lastId from state.
 * When flush is set, drains the failures queue to a consolidated JSONL blob.
 */
export async function handleStart(
  message: MigrateCaseAppointmentsStartMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  if (message.flushQueues) {
    logger.info(MODULE_NAME, 'flushQueues flag detected — dumping queues to blob storage.');
    const objectStorage = factory.getObjectStorageGateway(context);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await dumpQueueToBlob(objectStorage, logger, START.queueName, `flush-start-${timestamp}.jsonl`);
    await dumpQueueToBlob(objectStorage, logger, PAGE.queueName, `flush-page-${timestamp}.jsonl`);
    await dumpQueueToBlob(objectStorage, logger, DLQ.queueName, `flush-dlq-${timestamp}.jsonl`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'flushQueues' },
    });
    return;
  }

  if (message.deleteAll) {
    logger.warn(MODULE_NAME, 'deleteAll flag detected — deleting all ACMS case appointments.');
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

  if (message.flush) {
    logger.info(MODULE_NAME, 'flush flag detected — failures queue drain not yet implemented.');
    return;
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
  const startFresh = !!(message.reset || message.deleteAll);
  const lastId = startFresh ? null : (existingState?.lastId ?? null);
  const processedCount = startFresh ? 0 : (existingState?.processedCount ?? 0);

  logger.info(
    MODULE_NAME,
    startFresh
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
    const stateResult = await MigrateCaseAppointmentsUseCase.readMigrationState(context);
    const existingState = stateResult.error ? undefined : stateResult.data;
    await MigrateCaseAppointmentsUseCase.updateMigrationState(
      context,
      {
        lastId: existingState?.lastId ?? cursor.lastId,
        processedCount: existingState?.processedCount ?? 0,
        status: 'FAILED',
      },
      existingState,
    );
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
    if (result.failures.length > 0) {
      invocationContext.extraOutputs.set(
        FAILURES,
        result.failures.map((f) => JSON.stringify(f)),
      );
    }
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: result.processedCount,
      documentsFailed: 0,
      success: true,
      details: { reason: 'done' },
    });
    return;
  }

  if (result.failures.length > 0) {
    invocationContext.extraOutputs.set(
      FAILURES,
      result.failures.map((f) => JSON.stringify(f)),
    );
  }

  logger.debug(
    MODULE_NAME,
    `Processed ${result.processedCount} records (${result.successCount} created, ${result.failures.length} failed). Next cursor: ${result.nextLastId}.`,
  );

  invocationContext.extraOutputs.set(PAGE, { lastId: result.nextLastId });
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
    documentsWritten: result.successCount,
    documentsFailed: result.failures.length,
    success: true,
    details: { nextLastId: String(result.nextLastId) },
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
    extraOutputs: [PAGE, DLQ, FAILURES],
  });
}

export default {
  MODULE_NAME,
  setup,
};
