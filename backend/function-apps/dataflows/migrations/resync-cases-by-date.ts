import { app, InvocationContext, output } from '@azure/functions';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

import ApplicationContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import SyncCases from '../../../lib/use-cases/dataflows/sync-cases';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { isNotFoundError } from '../../../lib/common-errors/not-found-error';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { handleRateLimitRetry } from '../dataflows-rate-limit';
import { FIX_QUEUE_NAME } from './division-change-cleanup';
import ModuleNames from '../module-names';

const MODULE_NAME = ModuleNames.RESYNC_CASES_BY_DATE;
const PAGE_SIZE = 100;

type ResyncCasesByDateStartMessage = {
  fromDate: string;
};

type ResyncCasesByDatePageMessage = {
  events: CaseSyncEvent[];
  retryCount?: number;
  firstAttemptAt?: string;
};

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

const FIX = output.storageQueue({
  queueName: FIX_QUEUE_NAME,
  connection: STORAGE_QUEUE_CONNECTION,
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HANDLE_ERROR = buildFunctionName(MODULE_NAME, 'handleError');
const HANDLE_RETRY = buildFunctionName(MODULE_NAME, 'handleRetry');

export async function handleStart(
  message: ResyncCasesByDateStartMessage,
  invocationContext: InvocationContext,
) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const { fromDate } = message;
  if (!fromDate) {
    logger.error(MODULE_NAME, 'fromDate is required in the start message.');
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      details: { reason: 'missing fromDate' },
    });
    return;
  }

  logger.info(MODULE_NAME, `Starting resync of cases by date with fromDate: ${fromDate}`);

  const { events } = await SyncCases.getCaseIds(context, fromDate);

  if (!events.length) {
    logger.info(MODULE_NAME, `No cases found since ${fromDate}. Nothing to resync.`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { reason: 'no cases found' },
    });
    return;
  }

  const pages: ResyncCasesByDatePageMessage[] = [];
  let start = 0;
  let end = 0;
  while (end < events.length) {
    start = end;
    end += PAGE_SIZE;
    pages.push({ events: events.slice(start, end) });
  }

  invocationContext.extraOutputs.set(PAGE, pages);

  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleStart', logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: { pagesQueued: String(pages.length), totalEvents: String(events.length) },
  });
}

export async function handlePage(
  message: ResyncCasesByDatePageMessage,
  invocationContext: InvocationContext,
) {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const { events } = message;

  let processedEvents: CaseSyncEvent[];
  try {
    processedEvents = await ExportAndLoadCase.exportAndLoad(context, events);
  } catch (error) {
    const rateLimitRetryStatus = await handleRateLimitRetry({
      error,
      message,
      checkQueueName: PAGE.queueName,
      dlqOutput: DLQ,
      context,
      moduleName: MODULE_NAME,
      activityName: 'handlePage',
      connectionString,
    });

    if (rateLimitRetryStatus === 'retried') {
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: false,
        error: 'rate-limited-requeued',
      });
      return;
    }

    if (rateLimitRetryStatus === 'exhausted') {
      completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
        documentsWritten: 0,
        documentsFailed: 1,
        success: false,
        error: 'rate-limit-retry-exhausted',
      });
      return;
    }

    logger.error(MODULE_NAME, `handlePage failed: ${(error as Error).message}`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
      documentsWritten: 0,
      documentsFailed: events.length,
      success: false,
      error: (error as Error).message,
    });
    throw error;
  }

  const divisionChanges = processedEvents
    .filter((event) => event.divisionChange !== undefined && !event.error)
    .map((event) => event.divisionChange!);

  if (divisionChanges.length > 0) {
    invocationContext.extraOutputs.set(FIX, divisionChanges);
    logger.info(MODULE_NAME, `Queued ${divisionChanges.length} division changes to FIX`);
  }

  const failedEvents = processedEvents.filter((event) => !!event.error);
  if (failedEvents.length > 0) {
    logger.warn(MODULE_NAME, `${failedEvents.length} events failed, sending to DLQ`);
    invocationContext.extraOutputs.set(DLQ, failedEvents);
  }

  const successCount = processedEvents.length - failedEvents.length - divisionChanges.length;
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', logger, {
    documentsWritten: successCount,
    documentsFailed: failedEvents.length,
    success: true,
    additionalMetrics: [{ name: 'DataflowDivisionChangesQueued', value: divisionChanges.length }],
    details: {
      totalCases: String(events.length),
      divisionChangesQueued: String(divisionChanges.length),
    },
  });
}

export async function handleError(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const abandoned = isNotFoundError(event.error);

  if (abandoned) {
    logger.info(
      MODULE_NAME,
      `Abandoning attempt to sync ${event.caseId}: ${event.error?.['message']}`,
    );
  } else {
    logger.info(
      MODULE_NAME,
      `Error encountered attempting to sync ${event.caseId}: ${event.error?.['message']}`,
    );
    delete event.error;
    invocationContext.extraOutputs.set(RETRY, [event]);
  }

  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleError', logger, {
    documentsWritten: 0,
    documentsFailed: 1,
    success: true,
    details: { disposition: abandoned ? 'abandoned' : 'queued-for-retry' },
  });
}

export async function handleRetry(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const context = await ApplicationContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;
  const trace = context.observability.startTrace(invocationContext.invocationId);

  const RETRY_LIMIT = 3;
  event.retryCount = (event.retryCount ?? 0) + 1;

  if (event.retryCount > RETRY_LIMIT) {
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    logger.info(MODULE_NAME, `Too many attempts to sync ${event.caseId}`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: true,
      details: { disposition: 'hard-stop', retryCount: String(event.retryCount) },
    });
    return;
  }

  logger.info(MODULE_NAME, `Retry attempt ${event.retryCount} for ${event.caseId}`);

  const [processed] = await ExportAndLoadCase.exportAndLoad(context, [event]);

  if (processed.error) {
    invocationContext.extraOutputs.set(DLQ, [processed]);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: true,
      details: { disposition: 'retry-failed', retryCount: String(event.retryCount) },
    });
    return;
  }

  if (processed.divisionChange) {
    invocationContext.extraOutputs.set(FIX, [processed.divisionChange]);
    logger.info(MODULE_NAME, `Division change detected on retry for ${event.caseId}`);
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { disposition: 'division-change-queued', retryCount: String(event.retryCount) },
    });
    return;
  }

  logger.info(MODULE_NAME, `Successfully retried to sync ${event.caseId}`);
  completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handleRetry', logger, {
    documentsWritten: 1,
    documentsFailed: 0,
    success: true,
    details: { disposition: 'retry-succeeded', retryCount: String(event.retryCount) },
  });
}

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
    extraOutputs: [PAGE, DLQ, FIX],
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
    extraOutputs: [DLQ, HARD_STOP, FIX],
  });
}

export default {
  MODULE_NAME,
  setup,
};
