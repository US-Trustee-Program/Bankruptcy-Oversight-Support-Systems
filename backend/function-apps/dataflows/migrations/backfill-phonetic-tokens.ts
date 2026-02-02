import { app, InvocationContext, output } from '@azure/functions';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  RangeMessage,
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
const GET_CASES_NEEDING_BACKFILL = buildFunctionName(MODULE_NAME, 'getCasesNeedingBackfill');
const INITIALIZE_BACKFILL = buildFunctionName(MODULE_NAME, 'initializeBackfill');

type BackfillEvent = BackfillCase & {
  retryCount?: number;
  error?: Error;
};

/**
 * handleStart
 *
 * Initialize the backfill migration by counting cases that need phonetic tokens
 * and creating page messages for batch processing.
 */
async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const result = await BackfillPhoneticTokensUseCase.initializeBackfill(context);

  if (result.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, INITIALIZE_BACKFILL),
    );
    return;
  }

  const count = result.data ?? 0;
  logger.info(MODULE_NAME, `Found ${count} cases needing phonetic token backfill.`);

  if (count === 0) {
    logger.info(MODULE_NAME, 'No cases need backfill. Migration complete.');
    return;
  }

  // Create page messages for batch processing
  let start = 0;
  let end = 0;

  const pages: RangeMessage[] = [];
  while (end < count) {
    start = end;
    end += PAGE_SIZE;
    pages.push({ start, end });
  }

  logger.info(MODULE_NAME, `Queueing ${pages.length} pages for processing.`);
  invocationContext.extraOutputs.set(PAGE, pages);
}

/**
 * handlePage
 *
 * Process a page of cases by fetching cases needing backfill
 * and updating them with phonetic tokens.
 */
async function handlePage(range: RangeMessage, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const casesResult = await BackfillPhoneticTokensUseCase.getPageOfCasesNeedingBackfill(
    context,
    range.start,
    range.end - range.start,
  );

  if (casesResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(casesResult.error, MODULE_NAME, GET_CASES_NEEDING_BACKFILL),
    );
    return;
  }

  const cases = casesResult.data ?? [];
  if (cases.length === 0) {
    logger.debug(MODULE_NAME, `No cases in range ${range.start}-${range.end} need backfill.`);
    return;
  }

  logger.debug(
    MODULE_NAME,
    `Processing ${cases.length} cases in range ${range.start}-${range.end}.`,
  );

  const backfillResult = await BackfillPhoneticTokensUseCase.backfillTokensForCases(context, cases);

  if (backfillResult.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(backfillResult.error, MODULE_NAME, HANDLE_PAGE),
    );
    return;
  }

  const results = backfillResult.data ?? [];
  const failedResults = results.filter((r) => !r.success);

  if (failedResults.length > 0) {
    logger.warn(MODULE_NAME, `${failedResults.length} cases failed to backfill.`);
    const failedEvents: BackfillEvent[] = failedResults.map((r) => ({
      caseId: r.caseId,
      error: new Error(r.error ?? 'Unknown error'),
    }));
    invocationContext.extraOutputs.set(DLQ, failedEvents);
  }

  const successCount = results.filter((r) => r.success).length;
  logger.debug(MODULE_NAME, `Successfully backfilled ${successCount} cases.`);
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
    extraOutputs: [DLQ],
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
