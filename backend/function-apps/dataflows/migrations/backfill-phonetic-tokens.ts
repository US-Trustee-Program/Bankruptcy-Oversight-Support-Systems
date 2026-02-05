import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  CursorMessage,
  StartMessage,
} from '../dataflows-common';
import BackfillPhoneticTokensUseCase, {
  BackfillCase,
} from '../../../lib/use-cases/dataflows/backfill-phonetic-tokens';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.BACKFILL_PHONETIC_TOKENS;
const PAGE_SIZE = 100;

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

type BackfillEvent = BackfillCase & {
  retryCount?: number;
  error?: Error;
};

/**
 * handleStart
 *
 * Initialize the backfill migration by reading existing state for resumability.
 * If already completed, skip. Otherwise, queue first/next CursorMessage with lastId from state.
 * No counting - uses cursor-based pagination for efficiency.
 */
async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const stateResult = await BackfillPhoneticTokensUseCase.readBackfillState(context);

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
      `Backfill already completed at ${existingState.lastUpdatedAt}. Processed ${existingState.processedCount} cases. Skipping.`,
    );
    return;
  }

  // Resume from existing state or start fresh
  const lastId = existingState?.lastId ?? null;
  const processedCount = existingState?.processedCount ?? 0;

  if (existingState) {
    logger.info(
      MODULE_NAME,
      `Resuming backfill from cursor ${lastId}. Already processed ${processedCount} cases.`,
    );
  } else {
    logger.info(MODULE_NAME, 'Starting fresh phonetic token backfill migration.');
  }

  // Queue the first/next cursor message
  const cursorMessage: CursorMessage = { lastId };
  invocationContext.extraOutputs.set(PAGE, cursorMessage);
}

/**
 * handlePage
 *
 * Process a page of cases using cursor-based pagination.
 * Fetches page using cursor, processes batch, updates state with new cursor position.
 * If hasMore, queues next CursorMessage. If no more results, sets status to COMPLETED.
 */
async function handlePage(cursor: CursorMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  // Read current state to get processedCount
  const stateResult = await BackfillPhoneticTokensUseCase.readBackfillState(context);
  if (stateResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(stateResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  const currentProcessedCount = stateResult.data?.processedCount ?? 0;

  // Fetch page using cursor
  const casesResult = await BackfillPhoneticTokensUseCase.getPageOfCasesNeedingBackfillByCursor(
    context,
    cursor.lastId,
    PAGE_SIZE,
  );

  if (casesResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(casesResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  const { cases, lastId: newLastId, hasMore } = casesResult.data;

  if (cases.length === 0) {
    // No more cases to process - mark as completed
    logger.info(MODULE_NAME, `No more cases to backfill. Migration complete.`);

    await BackfillPhoneticTokensUseCase.updateBackfillState(context, {
      lastId: cursor.lastId,
      processedCount: currentProcessedCount,
      status: 'COMPLETED',
    });
    return;
  }

  logger.debug(
    MODULE_NAME,
    `Processing ${cases.length} cases. Cursor: ${cursor.lastId ?? 'start'} -> ${newLastId}.`,
  );

  // Process the batch
  const backfillResult = await BackfillPhoneticTokensUseCase.backfillTokensForCases(context, cases);

  if (backfillResult.error) {
    // Update state with FAILED status
    await BackfillPhoneticTokensUseCase.updateBackfillState(context, {
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

  // Update state with new cursor position
  const updateResult = await BackfillPhoneticTokensUseCase.updateBackfillState(context, {
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

  // Handle failed cases
  if (failedResults.length > 0) {
    logger.warn(MODULE_NAME, `${failedResults.length} cases failed to backfill.`);
    const failedEvents: BackfillEvent[] = failedResults.map((r) => {
      const originalCase = cases.find((c) => c.caseId === r.caseId);
      return {
        _id: originalCase?._id ?? '',
        caseId: r.caseId,
        debtor: originalCase?.debtor,
        jointDebtor: originalCase?.jointDebtor,
        error: new Error(r.error ?? 'Unknown error'),
      };
    });
    invocationContext.extraOutputs.set(DLQ, failedEvents);
  }

  logger.debug(
    MODULE_NAME,
    `Successfully backfilled ${successCount} cases. Total processed: ${newProcessedCount}.`,
  );

  // If there are more results, queue next cursor message
  if (hasMore) {
    const nextCursor: CursorMessage = { lastId: newLastId };
    invocationContext.extraOutputs.set(PAGE, nextCursor);
  } else {
    logger.info(
      MODULE_NAME,
      `Backfill migration complete. Total processed: ${newProcessedCount} cases.`,
    );
  }
}

/**
 * handleError
 *
 * Route failed events to retry queue for another attempt.
 */
async function handleError(event: BackfillEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  logger.info(
    MODULE_NAME,
    `Error encountered backfilling case ${event.caseId}: ${event.error?.message ?? 'Unknown error'}.`,
  );

  delete event.error;
  invocationContext.extraOutputs.set(RETRY, [event]);
}

/**
 * handleRetry
 *
 * Retry backfilling a single case with retry limit tracking.
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
    logger.info(MODULE_NAME, `Too many retry attempts for case ${event.caseId}.`);
    return;
  }

  const backfillCase: BackfillCase = {
    _id: event._id,
    caseId: event.caseId,
    debtor: event.debtor,
    jointDebtor: event.jointDebtor,
  };

  const result = await BackfillPhoneticTokensUseCase.backfillTokensForCases(context, [
    backfillCase,
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
    route: 'backfill-phonetic-tokens',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export default {
  MODULE_NAME,
  setup,
};
