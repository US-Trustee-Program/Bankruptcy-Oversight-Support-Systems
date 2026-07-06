import { app, InvocationContext, output } from '@azure/functions';
import { QueueServiceClient } from '@azure/storage-queue';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import {
  buildContainerName,
  buildFunctionName,
  buildQueueName,
  ensureContainersExist,
} from '../dataflows-common';
import MigrateCaseAppointmentsUseCase, {
  ResolvedAcmsRecord,
} from '../../../lib/use-cases/dataflows/migrate-case-appointments';
import {
  SAFE_THRESHOLD_MS,
  FETCH_SIZE,
  WRITE_BATCH_SIZE,
} from '../../../lib/use-cases/dataflows/migrate-case-appointments-constants';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import ModuleNames from '../module-names';
import factory from '../../../lib/factory';

const MODULE_NAME = ModuleNames.MIGRATE_CASE_APPOINTMENTS;

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
 *   Fresh start:    {} — no lastId, no resume
 *     - Resets cursor to null, resets state, loads professional ID map, begins
 *     - Phase 1 (reindex): checks compound index; re-enqueues with 60s delay if not ready
 *     - Phase 2 (backfill): writes denormalized case fields to both partitions
 *
 *   Resume:         { resume: true }
 *     - Picks up from last committed lastId without deleting or resetting
 *     - No-op if migration is already COMPLETED or no state exists
 *
 *   Halt:           { halt: true }
 *     - Sets status=FAILED in state and purges START + PAGE queues
 *     - Prevents any in-flight or queued continuations from processing
 *     - Recovery requires a fresh start {}
 *
 *   Continuation:   { lastId: number | null, attempt?: number }
 *     - Emitted by handleStart to itself after each ACMS fetch
 *     - Never triggers reset or cursor reset
 *
 *   Diagnostic:     { flushQueues: true }
 *
 *   Heal:           { heal: true }
 *     - Runs aggregation to count missing dateFiled documents
 *     - Logs structured summary at INFO; repairs divergence
 */
export type MigrateCaseAppointmentsStartMessage = {
  lastId?: number | null;
  attempt?: number;
  flushQueues?: boolean;
  resume?: boolean;
  halt?: boolean;
  heal?: boolean;
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
 *    - Update state (lastId)
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

  if (message.halt) {
    logger.warn(MODULE_NAME, 'halt intent received — marking FAILED and purging work queues.');
    const connectionString = process.env.AzureWebJobsDataflowsStorage;
    if (connectionString) {
      const queueService = QueueServiceClient.fromConnectionString(connectionString);
      await Promise.allSettled([
        queueService.getQueueClient(START.queueName).clearMessages(),
        queueService.getQueueClient(PAGE.queueName).clearMessages(),
      ]);
      logger.warn(MODULE_NAME, `Purged queues: ${START.queueName}, ${PAGE.queueName}`);
    }
    await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
      lastId: null,
      status: 'FAILED',
    });
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'halt' },
    });
    return;
  }

  if (message.heal) {
    logger.info(MODULE_NAME, 'heal intent — computing divergence summary.');
    const summary = await MigrateCaseAppointmentsUseCase.healSummary(context);
    logger.info(MODULE_NAME, `heal summary: caseMissingDateFiled=${summary.caseMissingDateFiled}`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'heal', caseMissingDateFiled: String(summary.caseMissingDateFiled) },
    });
    return;
  }

  if (message.resume) {
    const stateResult = await MigrateCaseAppointmentsUseCase.readMigrationState(context);
    if (stateResult.error || !stateResult.data) {
      logger.warn(MODULE_NAME, 'resume: no existing state found — nothing to resume.');
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { mode: 'resume', reason: 'no-state' },
      });
      return;
    }
    const existingState = stateResult.data;
    if (existingState.status === 'COMPLETED') {
      logger.info(MODULE_NAME, 'resume: migration already COMPLETED — nothing to do.');
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { mode: 'resume', reason: 'already-completed' },
      });
      return;
    }
    logger.info(
      MODULE_NAME,
      `resume: continuing from cursor ${existingState.lastId}. Already processed ${existingState.processedCount} records.`,
    );
    await MigrateCaseAppointmentsUseCase.incrementMetric(context, 'resumeAttempts');
    invocationContext.extraOutputs.set(START, { lastId: existingState.lastId });
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'resume', lastId: String(existingState.lastId) },
    });
    return;
  }

  const isContinuation = message.lastId !== undefined;

  if (!isContinuation) {
    // Phase 1 — Reindex: ensure compound index is ready before beginning backfill.
    // If index build is not yet complete, re-enqueue self with a 60s visibility delay.
    const reindexResult = await MigrateCaseAppointmentsUseCase.reindexPhase(context);
    if (reindexResult.status === 'needs-polling') {
      const connectionString = process.env.AzureWebJobsDataflowsStorage;
      if (connectionString) {
        const queueClient = StorageQueueHumbleObject.fromConnectionString(
          connectionString,
          START.queueName,
        );
        await queueClient.sendMessage(JSON.stringify({}), 60);
        logger.info(MODULE_NAME, 'Fresh start: index not ready — re-enqueued with 60s delay.');
      } else {
        logger.warn(
          MODULE_NAME,
          'Fresh start: index not ready but AzureWebJobsDataflowsStorage not set — cannot re-enqueue.',
        );
      }
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { mode: 'reindex-polling' },
      });
      return;
    }

    // Mark FAILED immediately to block stale PAGE writers from the prior run.
    // Preserve existing metric counters — they remain useful diagnostic context
    // until the IN_PROGRESS write resets them for the new run.
    logger.info(MODULE_NAME, 'Fresh start — resetting cursor.');
    await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
      lastId: null,
      status: 'FAILED',
    });

    // Clear the module-level cache so the first continuation loads a fresh map.
    MigrateCaseAppointmentsUseCase.clearProfessionalIdMapCache();

    await MigrateCaseAppointmentsUseCase.updateMigrationState(context, {
      lastId: null,
      resetCounters: true,
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

  // Read state: check for FAILED (retry exhaustion on a prior message may have
  // set this while other continuations were still in flight) and abort cleanly.
  const contStateResult = await MigrateCaseAppointmentsUseCase.readMigrationState(context);
  if (!contStateResult.error && contStateResult.data?.status === 'FAILED') {
    logger.warn(
      MODULE_NAME,
      `Continuation at cursor ${message.lastId} aborted — migration status is FAILED.`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'aborted-failed-state' },
    });
    return;
  }
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

    if (isTransientSqlTimeout && attempt <= 3) {
      logger.warn(
        MODULE_NAME,
        `Transient SQL timeout on attempt ${attempt}/3 at cursor ${message.lastId} — re-queuing for retry.`,
      );
      await MigrateCaseAppointmentsUseCase.incrementMetric(context, 'acmsQueryRetries');
      invocationContext.extraOutputs.set(START, { lastId: message.lastId, attempt: attempt + 1 });
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { mode: 'retry', attempt: String(attempt) },
      });
      return;
    }

    await MigrateCaseAppointmentsUseCase.updateMigrationState(
      context,
      { lastId: message.lastId ?? null, status: 'FAILED' },
      contStateResult.data,
    );
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
    await MigrateCaseAppointmentsUseCase.updateMigrationState(
      context,
      { lastId: message.lastId ?? null, readingCompleted: true, status: 'COMPLETED' },
      contStateResult.data,
    );
    logger.info(MODULE_NAME, `ACMS reading complete. All pages enqueued.`);
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

  // Update lastId cursor — processedCount is managed exclusively by handlePage via atomicIncrement
  await MigrateCaseAppointmentsUseCase.updateMigrationState(
    context,
    { lastId: readResult.nextLastId, readingCompleted: false, status: 'IN_PROGRESS' },
    contStateResult.data,
  );

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
 * handleEscapeHatch — re-enqueues remaining records to PAGE queue with visibility delay,
 * or routes them to FAILURES when re-enqueue is not possible.
 *
 * Returns serialized failure entries so the caller can merge them with any
 * per-record failures before a single extraOutputs.set(FAILURES, ...) call,
 * avoiding the last-write-wins overwrite bug.
 */
async function handleEscapeHatch(
  context: ApplicationContext,
  result: { remaining: ResolvedAcmsRecord[]; recommendedVisibilitySeconds: number },
): Promise<string[]> {
  if (result.remaining.length === 0) return [];

  const { logger } = context;
  const connectionString = process.env.AzureWebJobsDataflowsStorage;

  if (!connectionString) {
    logger.error(
      MODULE_NAME,
      `Escape hatch triggered but AzureWebJobsDataflowsStorage is not set — routing ${result.remaining.length} records to FAILURES.`,
    );
    await MigrateCaseAppointmentsUseCase.incrementMetric(
      context,
      'failedCount',
      result.remaining.length,
    );
    return result.remaining.map((r) =>
      JSON.stringify({ record: r, reason: 'escape-hatch-no-connection-string' }),
    );
  }

  const jitterSeconds = Math.floor(Math.random() * 30);
  const visibilityTimeoutSeconds = result.recommendedVisibilitySeconds + jitterSeconds;

  // Chunk remaining records to stay within the 64 KB Azure Storage Queue message limit,
  // matching the same WRITE_BATCH_SIZE guard used by handleStart.
  const chunks: ResolvedAcmsRecord[][] = [];
  for (let i = 0; i < result.remaining.length; i += WRITE_BATCH_SIZE) {
    chunks.push(result.remaining.slice(i, i + WRITE_BATCH_SIZE));
  }

  try {
    const queueClient = StorageQueueHumbleObject.fromConnectionString(
      connectionString,
      PAGE.queueName,
    );
    for (const chunk of chunks) {
      await queueClient.sendMessage(
        JSON.stringify({ records: chunk } as MigrateCaseAppointmentsPageMessage),
        visibilityTimeoutSeconds,
      );
    }
    logger.warn(
      MODULE_NAME,
      `Escape hatch triggered — re-enqueued ${result.remaining.length} records in ${chunks.length} message(s) with ${visibilityTimeoutSeconds}s visibility delay.`,
    );
    await MigrateCaseAppointmentsUseCase.incrementMetric(
      context,
      'reEnqueuedCount',
      result.remaining.length,
    );
    return [];
  } catch (sendError) {
    logger.error(
      MODULE_NAME,
      `Escape hatch re-enqueue failed — routing ${result.remaining.length} records to FAILURES.`,
      { error: String(sendError) },
    );
    await MigrateCaseAppointmentsUseCase.incrementMetric(
      context,
      'failedCount',
      result.remaining.length,
    );
    return result.remaining.map((r) =>
      JSON.stringify({ record: r, reason: 'escape-hatch-reenqueue-failed' }),
    );
  }
}

/**
 * handlePage — pure Cosmos writer.
 * Receives pre-resolved records, upserts to both Cosmos collections,
 * routes failures to the failures queue.
 */
export async function handlePage(
  message: MigrateCaseAppointmentsPageMessage,
  invocationContext: InvocationContext,
) {
  const invocationStartedAt = Date.now();
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const { records } = message;

  // Abort if migration has been halted or failed — discard this write batch
  const pageStateResult = await MigrateCaseAppointmentsUseCase.readMigrationState(context);
  if (!pageStateResult.error && pageStateResult.data?.status === 'FAILED') {
    logger.warn(MODULE_NAME, 'handlePage: migration is FAILED — discarding write batch.');
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { mode: 'aborted-failed-state' },
    });
    return;
  }

  const result = await MigrateCaseAppointmentsUseCase.writePage(context, records, {
    startedAt: invocationStartedAt,
    safeThresholdMs: SAFE_THRESHOLD_MS,
  });

  const escapeHatchFailures = await handleEscapeHatch(context, result);

  // Merge escape-hatch and per-record failures into a single set call.
  // extraOutputs.set is last-write-wins — two separate calls would drop one set.
  const allFailures = [...result.failures.map((f) => JSON.stringify(f)), ...escapeHatchFailures];
  if (allFailures.length > 0) {
    invocationContext.extraOutputs.set(FAILURES, allFailures);
  }

  // Atomically increment counters — no read-modify-write race
  if (result.successCount > 0) {
    await MigrateCaseAppointmentsUseCase.incrementMetric(
      context,
      'processedCount',
      result.successCount,
    );
  }
  if (result.failures.length > 0) {
    await MigrateCaseAppointmentsUseCase.incrementMetric(
      context,
      'failedCount',
      result.failures.length,
    );
  }

  logger.debug(
    MODULE_NAME,
    `Wrote ${result.successCount} appointments (${result.failures.length} failed, ${result.remaining.length} re-enqueued).`,
  );
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
    documentsWritten: result.successCount,
    documentsFailed: result.failures.length,
    success: true,
    details: { batchSize: String(records.length), remaining: String(result.remaining.length) },
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
