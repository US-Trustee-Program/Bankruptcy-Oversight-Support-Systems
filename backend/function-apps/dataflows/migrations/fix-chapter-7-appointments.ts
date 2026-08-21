import { app, InvocationContext, output } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName, StartMessage } from '../dataflows-common';
import FixChapter7AppointmentsUseCase, {
  AppointmentIdPair,
} from '../../../lib/use-cases/dataflows/fix-chapter-7-appointments';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { handleRateLimitRetry } from '../dataflows-rate-limit';
import { pageByByteBudget } from '../dataflows-paging';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.FIX_CHAPTER_7_APPOINTMENTS;

// Number of matching id pairs fetched from Mongo per runReaderLoop iteration.
// Sourced from a single aggregate against trustee-case-appointments (the only
// one of the two collections with an index supporting chapter filtering — see
// findAppointmentIdPairsByChapter), which also $lookups each match's
// case-trustee-appointments counterpart, so both _ids are known up front and
// case-trustee-appointments is never queried by chapter directly.
//
// Kept small (rather than the original 10,000) to bound RU consumption per
// iteration: a smaller $match+$lookup is less likely to get RU-throttled
// mid-execution (see isRateLimitTimeoutError) and, if it is, wastes less work
// per retry. Lowered from 1000 to 100 after observing RU backoffs in
// production even at 1000.
const READER_BATCH_SIZE = 100;

// Each id pair carries two ~24-char Mongo ObjectId hex strings (~26 bytes each
// serialized). A maxPageSize cap keeps a single writer invocation's Mongo $in
// filter bounded and predictable regardless of id length; pageByByteBudget's
// byte budget is what actually keeps each WriterMessage under the Azure Queue
// size limit once the ids no longer fit (see dataflows-paging.ts). Only used
// for the escape-hatch dump of an unwritten batch to the writer queue — the
// default path never touches the writer queue at all.
const WRITER_MAX_PAGE_SIZE = 2000;

// Delay applied to a reader continuation enqueued by the escape hatch, so the
// writer queue (which just received the fallback dump, if any) has a moment
// to drain before the reader resumes querying the same stream.
const READER_REQUEUE_DELAY_SECONDS = 30;

// Visibility delay handleStart applies to the 2nd-Nth reader messages (see
// handleStart): a flat base plus a random jitter on top, so even the low end
// of the roll still lands well clear of the first (immediate) message. Keeps
// the four streams' query cycles desynchronized from each other on an
// ongoing basis: without this, all four start at the same instant, all four
// get RU-throttled together, and handleRateLimitRetry's backoff is
// deterministic per retry count, so they'd stay in lockstep — hitting Cosmos
// simultaneously on every subsequent round too.
const START_JITTER_BASE_SECONDS = 30;
const START_JITTER_RANDOM_MAX_SECONDS = 60;

export type FixChapter7AppointmentsStartMessage = StartMessage;

export type ReaderMessage = {
  operation: 'rename' | 'delete';
  matchChapter: string;
  setChapter?: string;
  retryCount?: number;
  firstAttemptAt?: string;
};

export type WriterMessage = ReaderMessage & {
  idPairs: AppointmentIdPair[];
  retryCount?: number;
  firstAttemptAt?: string;
};

// The 4 chapter-fix operations performed by this one-time repair. Each is
// processed independently and loops (via handleReader re-enqueueing itself)
// until it reports zero remaining matching documents. Each operation fixes
// both collections per document (see findAppointmentIdPairsByChapter /
// applyChapterFix) rather than being split per collection.
const READER_MESSAGES: ReaderMessage[] = [
  { operation: 'rename', matchChapter: '7A', setChapter: '7' },
  { operation: 'rename', matchChapter: '7N', setChapter: '7' },
  { operation: 'rename', matchChapter: '09', setChapter: '9' },
  { operation: 'delete', matchChapter: 'AC' },
];

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const READER = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'reader'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const WRITER = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'writer'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_READER = buildFunctionName(MODULE_NAME, 'handleReader');
const HANDLE_WRITER = buildFunctionName(MODULE_NAME, 'handleWriter');

/**
 * handleStart — fresh-start only. Enqueues the 4 fixed ReaderMessages, one per
 * chapter-fix operation. No halt/resume/heal — this is a one-time repair with
 * no state to manage across invocations.
 *
 * Sends 4 separate messages via the imperative StorageQueueHumbleObject client
 * rather than invocationContext.extraOutputs.set(): extraOutputs.set() sends
 * exactly one queue message per invocation, serializing whatever value it is
 * given as a single message body. Passing it an array of 4 messages would
 * collapse them into one oversized message instead of 4 independent ones (see
 * the queueEventPages comment in sync-trustee-case-appointments.ts for the
 * production incident this caused).
 *
 * The first message is sent immediately; the 2nd-Nth messages each get a
 * random visibility delay (see START_JITTER_MAX_SECONDS) so the four streams'
 * query cycles start desynchronized rather than all firing — and all getting
 * RU-throttled — at the same instant.
 */
async function handleStart(
  _startMessage: FixChapter7AppointmentsStartMessage,
  invocationContext: InvocationContext,
) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const connectionString = process.env.AzureWebJobsDataflowsStorage;
    if (!connectionString) {
      throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
    }

    const queueClient = StorageQueueHumbleObject.fromConnectionString(
      connectionString,
      READER.queueName,
    );
    for (const [index, readerMessage] of READER_MESSAGES.entries()) {
      const visibilityTimeout =
        index === 0
          ? undefined
          : START_JITTER_BASE_SECONDS + Math.floor(Math.random() * START_JITTER_RANDOM_MAX_SECONDS);
      logger.info(
        MODULE_NAME,
        `Enqueueing reader stream operation=${readerMessage.operation} matchChapter=${readerMessage.matchChapter} jitterSeconds=${visibilityTimeout ?? 0}`,
      );
      await queueClient.sendMessage(JSON.stringify(readerMessage), visibilityTimeout);
    }

    logger.info(MODULE_NAME, `Enqueued ${READER_MESSAGES.length} reader message(s).`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { readersEnqueued: String(READER_MESSAGES.length) },
    });
  } catch (originalError) {
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: originalError instanceof Error ? originalError.message : String(originalError),
    });
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, HANDLE_START),
    );
  }
}

/**
 * handleReader — default mode: loops reading batches of matching id pairs and
 * applying the fix to both partitions directly (bypassing the writer queue
 * entirely), via FixChapter7AppointmentsUseCase.runReaderLoop. This is faster
 * than the old reader/writer-queue round trip for the common case, since
 * Cosmos throttling is usually transient and resolves within the loop's own
 * in-process backoff.
 *
 * runReaderLoop handles 429/RU-throttling retries and its own escape hatch
 * internally (see SAFE_THRESHOLD_MS) — it stops itself well before the Azure
 * Functions execution timeout regardless of how much throttling is
 * encountered, rather than relying on this handler to guess. On escape:
 *   - Any batch read this iteration but not yet written (unwrittenIdPairs) is
 *     paged and dumped to the writer queue as a fallback, so no work is lost.
 *   - A plain reader continuation (no retryCount/firstAttemptAt — this is not
 *     a queue-level rate-limit retry, just "there's more work") is
 *     re-enqueued with a short delay.
 *
 * When the stream reports complete (an empty read), nothing is re-enqueued.
 * Non-rate-limit errors escaping runReaderLoop route straight to DLQ.
 */
async function handleReader(message: ReaderMessage, invocationContext: InvocationContext) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);
  const startedAt = Date.now();

  try {
    const result = await FixChapter7AppointmentsUseCase.runReaderLoop(
      context,
      message.matchChapter,
      message.operation,
      message.setChapter,
      READER_BATCH_SIZE,
      { startedAt },
    );

    if (result.streamComplete) {
      logger.info(
        MODULE_NAME,
        `Stream complete: operation=${message.operation} matchChapter=${message.matchChapter} totalModified=${result.totalModified}`,
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleReader', logger, {
        documentsWritten: result.totalModified,
        documentsFailed: 0,
        success: true,
        details: {
          operation: message.operation,
          matchChapter: message.matchChapter,
          streamComplete: 'true',
        },
      });
      return;
    }

    // Escape hatch fired: fall back to the writer queue for anything read but
    // not yet written, then re-enqueue a plain reader continuation.
    if (result.unwrittenIdPairs.length > 0) {
      const { pages } = pageByByteBudget(result.unwrittenIdPairs, WRITER_MAX_PAGE_SIZE);
      const writerQueueClient = StorageQueueHumbleObject.fromConnectionString(
        connectionString,
        WRITER.queueName,
      );
      for (const page of pages) {
        const writerMessage: WriterMessage = {
          operation: message.operation,
          matchChapter: message.matchChapter,
          setChapter: message.setChapter,
          idPairs: page,
        };
        await writerQueueClient.sendMessage(JSON.stringify(writerMessage));
      }
      logger.info(
        MODULE_NAME,
        `Escape hatch: dumped ${result.unwrittenIdPairs.length} unwritten id pair(s) to the writer queue across ${pages.length} page(s).`,
      );
    }

    const continuationMessage: ReaderMessage = {
      operation: message.operation,
      matchChapter: message.matchChapter,
      setChapter: message.setChapter,
    };
    const readerQueueClient = StorageQueueHumbleObject.fromConnectionString(
      connectionString,
      READER.queueName,
    );
    const visibilityTimeoutSeconds =
      READER_REQUEUE_DELAY_SECONDS + result.recommendedVisibilitySeconds;
    await readerQueueClient.sendMessage(
      JSON.stringify(continuationMessage),
      visibilityTimeoutSeconds,
    );

    logger.info(
      MODULE_NAME,
      `Escape hatch: re-enqueued reader continuation for operation=${message.operation} matchChapter=${message.matchChapter} after ${Date.now() - startedAt}ms, delaySeconds=${visibilityTimeoutSeconds}.`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleReader', logger, {
      documentsWritten: result.totalModified,
      documentsFailed: 0,
      success: true,
      details: {
        operation: message.operation,
        matchChapter: message.matchChapter,
        streamComplete: 'false',
        unwrittenIdPairs: String(result.unwrittenIdPairs.length),
      },
    });
  } catch (error) {
    const camsError = getCamsError(error, MODULE_NAME);
    logger.error(MODULE_NAME, `handleReader failed: ${camsError.message}`, {
      operation: message.operation,
      matchChapter: message.matchChapter,
    });
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleReader', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: camsError.message,
    });
    invocationContext.extraOutputs.set(DLQ, buildQueueError(error, MODULE_NAME, HANDLE_READER));
  }
}

/**
 * handleWriter — applies the chapter fix (rename or delete) to one page of ids
 * to both collections for each id pair carried by the message. On 429/RU-
 * throttling, retries with backoff via handleRateLimitRetry; exhausted
 * retries route to DLQ; non-rate-limit errors rethrow so Azure Functions'
 * own retry/poison-queue mechanism handles genuinely unexpected errors.
 */
async function handleWriter(message: WriterMessage, invocationContext: InvocationContext) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const result = await FixChapter7AppointmentsUseCase.applyFix(
      context,
      message.idPairs,
      message.operation,
      message.matchChapter,
      message.setChapter,
    );

    logger.info(
      MODULE_NAME,
      `handleWriter: operation=${message.operation} matchChapter=${message.matchChapter} wrote ${result.modifiedCount} of ${message.idPairs.length} id pair(s) (escape-hatch fallback page).`,
    );
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleWriter', logger, {
      documentsWritten: result.modifiedCount,
      documentsFailed: 0,
      success: true,
      details: {
        operation: message.operation,
        matchChapter: message.matchChapter,
        idPairsAttempted: String(message.idPairs.length),
      },
    });
  } catch (error) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: WRITER.queueName,
      dlqOutput: DLQ,
      context,
      moduleName: MODULE_NAME,
      activityName: 'handleWriter',
      connectionString,
    });

    if (rateLimitRetryStatus === 'retried') {
      logger.info(
        MODULE_NAME,
        `handleWriter: operation=${message.operation} matchChapter=${message.matchChapter} hit a transient error (RU throttling or gateway timeout) on ${message.idPairs.length} id pair(s) — re-enqueued with backoff (retryCount=${(message.retryCount ?? 0) + 1}).`,
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleWriter', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: 'rate-limited-requeued',
      });
      return;
    }

    if (rateLimitRetryStatus === 'exhausted') {
      logger.warn(
        MODULE_NAME,
        `handleWriter: operation=${message.operation} matchChapter=${message.matchChapter} rate-limit retries exhausted for ${message.idPairs.length} id pair(s) — routed to DLQ.`,
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleWriter', logger, {
        documentsWritten: 0,
        documentsFailed: message.idPairs.length,
        success: false,
        error: 'rate-limit-retry-exhausted',
      });
      return;
    }

    const camsError = getCamsError(error, MODULE_NAME);
    logger.error(MODULE_NAME, `handleWriter failed: ${camsError.message}`, {
      operation: message.operation,
      matchChapter: message.matchChapter,
    });
    throw error;
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: START.connection,
    queueName: START.queueName,
    extraOutputs: [DLQ],
    handler: handleStart,
  });

  app.storageQueue(HANDLE_READER, {
    connection: READER.connection,
    queueName: READER.queueName,
    extraOutputs: [DLQ],
    handler: handleReader,
  });

  app.storageQueue(HANDLE_WRITER, {
    connection: WRITER.connection,
    queueName: WRITER.queueName,
    extraOutputs: [DLQ],
    handler: handleWriter,
  });
}

export { handleStart, handleReader, handleWriter };
export default {
  MODULE_NAME,
  setup,
};
