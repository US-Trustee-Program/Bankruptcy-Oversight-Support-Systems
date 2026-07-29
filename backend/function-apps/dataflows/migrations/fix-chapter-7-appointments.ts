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

// Number of matching id pairs fetched from Mongo per handleReader invocation.
// Sourced from a single aggregate against trustee-case-appointments (the only
// one of the two collections with an index supporting chapter filtering — see
// findAppointmentIdPairsByChapter), which also $lookups each match's
// case-trustee-appointments counterpart, so both _ids are known up front and
// case-trustee-appointments is never queried by chapter directly.
const READER_BATCH_SIZE = 10000;

// Each id pair carries two ~24-char Mongo ObjectId hex strings (~26 bytes each
// serialized). A maxPageSize cap keeps a single writer invocation's Mongo $in
// filter bounded and predictable regardless of id length; pageByByteBudget's
// byte budget is what actually keeps each WriterMessage under the Azure Queue
// size limit once the ids no longer fit (see dataflows-paging.ts).
const WRITER_MAX_PAGE_SIZE = 2000;

// After a reader page is fully drained to writer messages, the reader re-enqueues
// itself with this visibility delay so writers have time to apply the fix before
// the reader re-queries (avoiding re-reading documents that are mid-flight).
const READER_REQUEUE_DELAY_SECONDS = 30;

export type FixChapter7AppointmentsStartMessage = StartMessage;

export type ReaderMessage = {
  operation: 'rename' | 'delete';
  matchChapter: string;
  setChapter?: string;
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
    for (const readerMessage of READER_MESSAGES) {
      await queueClient.sendMessage(JSON.stringify(readerMessage));
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
 * handleReader — fetches up to READER_BATCH_SIZE matching document ids for this
 * stream's (operation, matchChapter), pages them into WriterMessages, and
 * re-enqueues itself with a delay so writers can drain before the next query.
 * When a query returns no id pairs, the stream is complete and nothing is
 * re-enqueued.
 */
async function handleReader(message: ReaderMessage, invocationContext: InvocationContext) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const idPairs = await FixChapter7AppointmentsUseCase.readIdPairs(
      context,
      message.matchChapter,
      READER_BATCH_SIZE,
    );

    if (idPairs.length === 0) {
      logger.info(
        MODULE_NAME,
        `Stream complete: operation=${message.operation} matchChapter=${message.matchChapter}`,
      );
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleReader', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: {
          operation: message.operation,
          matchChapter: message.matchChapter,
          idPairsFound: '0',
        },
      });
      return;
    }

    const { pages } = pageByByteBudget(idPairs, WRITER_MAX_PAGE_SIZE);

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

    const readerQueueClient = StorageQueueHumbleObject.fromConnectionString(
      connectionString,
      READER.queueName,
    );
    await readerQueueClient.sendMessage(JSON.stringify(message), READER_REQUEUE_DELAY_SECONDS);

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleReader', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: {
        operation: message.operation,
        matchChapter: message.matchChapter,
        idPairsFound: String(idPairs.length),
        pagesQueued: String(pages.length),
      },
    });
  } catch (originalError) {
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleReader', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: originalError instanceof Error ? originalError.message : String(originalError),
    });
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, HANDLE_READER),
    );
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
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleWriter', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: 'rate-limited-requeued',
      });
      return;
    }

    if (rateLimitRetryStatus === 'exhausted') {
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
