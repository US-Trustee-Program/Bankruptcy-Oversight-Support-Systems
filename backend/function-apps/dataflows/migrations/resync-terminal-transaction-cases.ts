import { app, InvocationContext, output } from '@azure/functions';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

import ApplicationContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  StartMessage,
} from '../dataflows-common';
import ResyncTerminalTransactionCases from '../../../lib/use-cases/dataflows/resync-terminal-transaction-cases';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { isNotFoundError } from '../../../lib/common-errors/not-found-error';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { filterToExtendedAscii } from '@common/cams/sanitization';
import { LoggerImpl } from '../../../lib/adapters/services/logger.service';

const MODULE_NAME = 'RESYNC-TERMINAL-TRANSACTION-CASES';
const PAGE_SIZE = 100;

// Message type with optional cutoffDate parameter
type ResyncStartMessage = StartMessage & {
  cutoffDate?: string; // Defaults to '2018-01-01'
};

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
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

/**
 * handleStart
 *
 * Query DXTR for cases with terminal transaction blind spot, paginate, and queue for processing.
 */
async function handleStart(message: ResyncStartMessage, context: InvocationContext) {
  const appContext = await ApplicationContextCreator.getApplicationContext({
    invocationContext: context,
  });
  const { logger } = appContext;

  const cutoffDate = message.cutoffDate || '2018-01-01';
  logger.info(MODULE_NAME, `Starting resync with cutoffDate: ${cutoffDate}`);

  // Get all case IDs with blind spot condition
  const result = await ResyncTerminalTransactionCases.getCaseIdsWithBlindSpot(
    appContext,
    cutoffDate,
  );

  if (result.error) {
    logger.error(MODULE_NAME, `Failed to get case IDs: ${result.error.message}`);
    throw result.error;
  }

  const events = result.events || [];
  const count = events.length;

  logger.info(MODULE_NAME, `Found ${count} cases with terminal transaction blind spot`);

  if (count === 0) {
    logger.info(MODULE_NAME, 'No cases to resync');
    return;
  }

  // Paginate events in-memory
  const pages: CaseSyncEvent[][] = [];
  for (let i = 0; i < events.length; i += PAGE_SIZE) {
    pages.push(events.slice(i, i + PAGE_SIZE));
  }

  logger.info(MODULE_NAME, `Created ${pages.length} pages for processing`);
  context.extraOutputs.set(PAGE, pages);
}

/**
 * handlePage
 *
 * Process a batch of case sync events via ExportAndLoadCase.
 */
async function handlePage(events: CaseSyncEvent[], invocationContext: InvocationContext) {
  const appContext = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = appContext;

  logger.info(MODULE_NAME, `Processing page with ${events.length} events`);

  const processedEvents = await ExportAndLoadCase.exportAndLoad(appContext, events);

  // Send failed events to DLQ
  const failedEvents = processedEvents.filter((event) => !!event.error);
  if (failedEvents.length > 0) {
    logger.warn(MODULE_NAME, `${failedEvents.length} events failed, sending to DLQ`);
    invocationContext.extraOutputs.set(DLQ, failedEvents);
  }
}

/**
 * Helper: Route error for initial attempt to appropriate queue.
 * NotFoundError = abandon, others = retry.
 */
function routeErrorForInitialAttempt(
  event: CaseSyncEvent,
  invocationContext: InvocationContext,
  logger: LoggerImpl,
): void {
  if (isNotFoundError(event.error)) {
    logger.info(MODULE_NAME, `Abandoning attempt to sync ${event.caseId}: ${event.error.message}`);
    return;
  }

  logger.info(
    MODULE_NAME,
    `Error encountered attempting to sync ${event.caseId}: ${event.error['message']}`,
  );
  delete event.error;
  invocationContext.extraOutputs.set(RETRY, [event]);
}

/**
 * handleError
 *
 * Route errors to appropriate queue: NotFoundError = abandon, others = retry.
 */
async function handleError(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);
  routeErrorForInitialAttempt(event, invocationContext, logger);
}

/**
 * Helper: Increment retry count and check limit.
 * If limit exceeded, route to HARD_STOP and return true (indicating stop).
 */
function incrementRetryCount(
  event: CaseSyncEvent,
  limit: number,
  invocationContext: InvocationContext,
  logger: LoggerImpl,
): boolean {
  event.retryCount = (event.retryCount ?? 0) + 1;

  if (event.retryCount > limit) {
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    logger.info(MODULE_NAME, `Too many attempts to sync ${filterToExtendedAscii(event.caseId)}`);
    return true;
  }
  return false;
}

/**
 * handleRetry
 *
 * Retry failed sync with limit of 3 attempts.
 */
async function handleRetry(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const RETRY_LIMIT = 3;
  const shouldStop = incrementRetryCount(event, RETRY_LIMIT, invocationContext, logger);
  if (shouldStop) return;

  logger.info(
    MODULE_NAME,
    `Retry attempt ${event.retryCount} for ${filterToExtendedAscii(event.caseId)}`,
  );

  // Reuse the same export + load pipeline as handlePage
  const [processed] = await ExportAndLoadCase.exportAndLoad(context, [event]);

  if (processed.error) {
    // Route failure to DLQ and keep error attached
    invocationContext.extraOutputs.set(DLQ, [processed]);
    return;
  }

  logger.info(MODULE_NAME, `Successfully retried to sync ${filterToExtendedAscii(event.caseId)}`);
}

/**
 * setup
 *
 * Register all handlers and triggers.
 */
function setup() {
  app.storageQueue(HANDLE_START, {
    connection: STORAGE_QUEUE_CONNECTION,
    queueName: START.queueName,
    handler: handleStart,
    extraOutputs: [PAGE],
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
    route: 'resync-terminal-transaction-cases',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export default {
  MODULE_NAME,
  setup,
};
