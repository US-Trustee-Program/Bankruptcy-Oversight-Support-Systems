import { app, InvocationContext, output } from '@azure/functions';
import { QueueServiceClient } from '@azure/storage-queue';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildContainerName,
  buildFunctionName,
  buildQueueName,
  ensureContainersExist,
} from '../dataflows-common';
import MigrateCaseAppointmentsUseCase, {
  ResolvedAcmsRecord,
} from '../../../lib/use-cases/dataflows/migrate-case-appointments';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';
import factory from '../../../lib/factory';

const MODULE_NAME = ModuleNames.MIGRATE_CASE_APPOINTMENTS;

// Rows fetched from ACMS per handleStart continuation invocation.
const FETCH_SIZE = 10000;

// Records per write queue message — sized to stay well under the 64KB queue limit.
const WRITE_BATCH_SIZE = 500;

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

const OUTPUT_CONTAINER = buildContainerName(MODULE_NAME, 'out');

/**
 * Start message shapes:
 *
 *   Fresh start:    {} or { flushQueues: true }
 *     - lastId is absent (undefined)
 *     - Always deletes all existing ACMS appointments and resets state
 *
 *   Continuation:   { lastId: number | null, attempt?: number }
 *     - lastId is present (including null for the very first page)
 *     - Emitted by handleStart to itself after each ACMS fetch
 *     - Never triggers reset or deleteAll
 */
export type MigrateCaseAppointmentsStartMessage = {
  lastId?: number | null;
  attempt?: number;
  flushQueues?: boolean;
};

/**
 * Write message: 100 pre-resolved records enqueued by handleStart,
 * consumed by handlePage (the pure Cosmos writer).
 */
export type MigrateCaseAppointmentsPageMessage = {
  records: ResolvedAcmsRecord[];
};

// Drains all messages from a named queue and writes them as a JSONL blob.
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
      lines.push(Buffer.from(msg.messageText, 'base64').toString('utf-8'));
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

/**
 * handleStart — two roles in one handler:
 *
 * 1. Fresh start (no lastId in message):
 *    - Delete all existing ACMS case appointments
 *    - Reset migration state
 *    - Enqueue first continuation { lastId: null }
 *
 * 2. Continuation ({ lastId }):
 *    - Fetch next FETCH_SIZE raw rows from ACMS
 *    - Format, pre-resolve professional IDs
 *    - Chunk into WRITE_BATCH_SIZE write messages → PAGE queue
 *    - Update state (lastId, pagesRead++)
 *    - If more records: enqueue next continuation → START queue
 *    - If empty: mark readingCompleted=true, status=COMPLETED
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

  const isContinuation = message.lastId !== undefined;

  if (!isContinuation) {
    // Fresh start — always delete all and reset before beginning
    logger.info(MODULE_NAME, 'Fresh start — deleting all ACMS appointments and resetting state.');
    const deleteResult = await MigrateCaseAppointmentsUseCase.deleteAll(context);
    if (deleteResult.error) {
      await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
        lastId: null,
        processedCount: 0,
        status: 'FAILED',
      });
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
      `Deleted ${deleteResult.data.deletedCount} existing ACMS appointments.`,
    );

    await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
      lastId: null,
      processedCount: 0,
      pagesRead: 0,
      readingCompleted: false,
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString(),
    });

    // Enqueue first continuation — lastId: null means start from the beginning
    invocationContext.extraOutputs.set(START, { lastId: null });
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'fresh-start' },
    });
    return;
  }

  // Continuation — fetch next batch from ACMS
  const attempt = message.attempt ?? 1;
  let readResult: Awaited<ReturnType<typeof MigrateCaseAppointmentsUseCase.readPage>>;
  try {
    readResult = await MigrateCaseAppointmentsUseCase.readPage(
      context,
      message.lastId ?? null,
      FETCH_SIZE,
    );
  } catch (originalError) {
    const errMsg = originalError instanceof Error ? originalError.message : String(originalError);
    const isTransientSqlTimeout = errMsg.includes('Timeout') || errMsg.includes('RequestError');

    if (isTransientSqlTimeout && attempt < 3) {
      logger.warn(
        MODULE_NAME,
        `Transient SQL timeout on attempt ${attempt} at cursor ${message.lastId} — re-queuing for retry.`,
      );
      invocationContext.extraOutputs.set(START, { lastId: message.lastId, attempt: attempt + 1 });
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { mode: 'retry', attempt: String(attempt) },
      });
      return;
    }

    await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
      lastId: message.lastId ?? null,
      processedCount: 0,
      status: 'FAILED',
    });
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(getCamsError(originalError, MODULE_NAME, errMsg), MODULE_NAME, HANDLE_START),
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: errMsg,
    });
    return;
  }

  if (readResult.isEmpty) {
    // All ACMS data enqueued — reading complete
    const stateResult = await MigrateCaseAppointmentsUseCase.readMigrationState(context);
    const existingState = stateResult.error ? null : stateResult.data;
    await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
      lastId: message.lastId ?? null,
      processedCount: existingState?.processedCount ?? 0,
      pagesRead: existingState?.pagesRead ?? 0,
      readingCompleted: true,
      status: 'COMPLETED',
    });
    logger.info(
      MODULE_NAME,
      `ACMS reading complete. All pages enqueued. Total pages: ${existingState?.pagesRead ?? 0}.`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'reading-complete' },
    });
    return;
  }

  // Chunk records into WRITE_BATCH_SIZE groups and enqueue to PAGE queue
  const chunks: ResolvedAcmsRecord[][] = [];
  for (let i = 0; i < readResult.records.length; i += WRITE_BATCH_SIZE) {
    chunks.push(readResult.records.slice(i, i + WRITE_BATCH_SIZE));
  }
  invocationContext.extraOutputs.set(
    PAGE,
    chunks.map((chunk) => JSON.stringify({ records: chunk } as MigrateCaseAppointmentsPageMessage)),
  );

  // Update state and enqueue next continuation
  const stateResult = await MigrateCaseAppointmentsUseCase.readMigrationState(context);
  const existingState = stateResult.error ? null : stateResult.data;
  await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
    lastId: readResult.nextLastId,
    processedCount: existingState?.processedCount ?? 0,
    pagesRead: (existingState?.pagesRead ?? 0) + 1,
    readingCompleted: false,
    status: 'IN_PROGRESS',
  });

  invocationContext.extraOutputs.set(START, { lastId: readResult.nextLastId });

  logger.debug(
    MODULE_NAME,
    `Fetched ${readResult.records.length} records. Enqueued ${chunks.length} write batches. Next cursor: ${readResult.nextLastId}.`,
  );
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
    documentsWritten: readResult.records.length,
    documentsFailed: 0,
    success: true,
    details: { nextLastId: String(readResult.nextLastId), batches: String(chunks.length) },
  });
}

/**
 * handlePage — pure Cosmos writer.
 * Receives 100 pre-resolved records, upserts to both Cosmos collections,
 * routes failures to the failures queue.
 */
export async function handlePage(
  message: MigrateCaseAppointmentsPageMessage,
  invocationContext: InvocationContext,
) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const { records } = message;

  const result = await MigrateCaseAppointmentsUseCase.writePage(context, records);

  if (result.failures.length > 0) {
    invocationContext.extraOutputs.set(
      FAILURES,
      result.failures.map((f) => JSON.stringify(f)),
    );
  }

  // Increment processedCount in migration state
  const stateResult = await MigrateCaseAppointmentsUseCase.readMigrationState(context);
  if (!stateResult.error && stateResult.data) {
    await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
      lastId: stateResult.data.lastId,
      processedCount: (stateResult.data.processedCount ?? 0) + result.successCount,
      pagesRead: stateResult.data.pagesRead,
      readingCompleted: stateResult.data.readingCompleted,
      status: stateResult.data.status,
    });
  }

  logger.debug(
    MODULE_NAME,
    `Wrote ${result.successCount} appointments (${result.failures.length} failed).`,
  );
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
    documentsWritten: result.successCount,
    documentsFailed: result.failures.length,
    success: true,
    details: { batchSize: String(records.length) },
  });
}

function setup() {
  ensureContainersExist([buildContainerName(MODULE_NAME, 'out')], MODULE_NAME);

  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [START, PAGE, DLQ, FAILURES],
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: PAGE.queueName,
    handler: handlePage,
    extraOutputs: [FAILURES],
  });
}

export default {
  MODULE_NAME,
  setup,
};
