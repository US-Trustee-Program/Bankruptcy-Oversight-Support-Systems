import { app, InvocationContext, output } from '@azure/functions';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

import ContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  RangeMessage,
  StartMessage,
} from '../dataflows-common';
import MigrateCases from '../../../lib/use-cases/dataflows/migrate-cases';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import CasesRuntimeState from '../../../lib/use-cases/dataflows/cases-runtime-state';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { isNotFoundError } from '../../../lib/common-errors/not-found-error';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { filterToExtendedAscii } from '@common/cams/sanitization';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { ApplicationContext } from '../../../lib/adapters/types/basic';

const MODULE_NAME = 'MIGRATE-CASES';
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
const GET_CASEIDS_TO_MIGRATE = buildFunctionName(MODULE_NAME, 'getCaseIdsToMigrate');
const LOAD_MIGRATION_TABLE = buildFunctionName(MODULE_NAME, 'loadMigrationTable');
const EMPTY_MIGRATION_TABLE = buildFunctionName(MODULE_NAME, 'emptyMigrationTable');

/**
 * handleStart
 *
 * Get case Ids from ACMS identifying cases to migrate then export and load the cases from DXTR into CAMS.
 *
 * @param {object} message
 * @param {InvocationContext} invocationContext
 */
async function handleStart(_ignore: StartMessage, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  try {
    const appContext = await ContextCreator.getApplicationContext({
      invocationContext,
      logger,
    });

    const trace = appContext.observability.startTrace(appContext.invocationId);
    const migrationStartTimestamp = new Date().toISOString();
    appContext.logger.info(
      MODULE_NAME,
      `MIGRATION_CUTOFF_TIMESTAMP=${migrationStartTimestamp} — Use this as cutoffDate for resync-remaining-cases.`,
    );

    const isEmpty = await emptyMigrationTable(appContext);
    if (!isEmpty) {
      completeDataflowTrace(
        appContext.observability,
        trace,
        MODULE_NAME,
        'handleStart',
        appContext.logger,
        {
          documentsWritten: 0,
          documentsFailed: 0,
          success: true,
          details: { reason: 'migration table not empty' },
        },
      );
      return;
    }

    const count = await loadMigrationTable(appContext);

    if (count === 0) {
      completeDataflowTrace(
        appContext.observability,
        trace,
        MODULE_NAME,
        'handleStart',
        appContext.logger,
        {
          documentsWritten: 0,
          documentsFailed: 0,
          success: true,
          details: { reason: 'no cases to migrate' },
        },
      );
      return;
    }

    let start = 0;
    let end = 0;

    const pages = [];
    while (end < count) {
      start = end + 1;
      end += PAGE_SIZE;
      pages.push({ start, end });
    }
    appContext.extraOutputs.set(PAGE, pages);

    await storeRuntimeState(appContext, migrationStartTimestamp);
    completeDataflowTrace(
      appContext.observability,
      trace,
      MODULE_NAME,
      'handleStart',
      appContext.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { pagesQueued: String(pages.length), totalCases: String(count) },
      },
    );
  } catch (error) {
    logger.error(MODULE_NAME, 'Failed in handleStart', error);
    throw error;
  }
}

/**
 * handlePage
 *
 * Get case Ids from ACMS identifying cases to migrate then export and load the cases from DXTR into CAMS.
 *
 * @param range
 * @param invocationContext
 */
async function handlePage(range: RangeMessage, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  try {
    const appContext = await ContextCreator.getApplicationContext({
      invocationContext,
      logger,
    });

    const trace = appContext.observability.startTrace(appContext.invocationId);
    const events: CaseSyncEvent[] = await getCaseIdsToMigrate(range, appContext);

    const processedEvents = await ExportAndLoadCase.exportAndLoad(appContext, events);

    const failedEvents = processedEvents.filter((event) => !!event.error);
    appContext.extraOutputs.set(DLQ, failedEvents);
    const successCount = processedEvents.length - failedEvents.length;
    completeDataflowTrace(
      appContext.observability,
      trace,
      MODULE_NAME,
      'handlePage',
      appContext.logger,
      {
        documentsWritten: successCount,
        documentsFailed: failedEvents.length,
        success: true,
        details: { totalEvents: String(events.length) },
      },
    );
  } catch (error) {
    logger.error(MODULE_NAME, 'Failed in handlePage', error);
    throw error;
  }
}

async function handleError(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  try {
    const appContext = await ContextCreator.getApplicationContext({
      invocationContext,
      logger,
    });

    const trace = appContext.observability.startTrace(appContext.invocationId);
    if (isNotFoundError(event.error)) {
      appContext.logger.info(
        MODULE_NAME,
        `Abandoning attempt to sync ${event.caseId}: ${event.error.message}.`,
      );
      completeDataflowTrace(
        appContext.observability,
        trace,
        MODULE_NAME,
        'handleError',
        appContext.logger,
        {
          documentsWritten: 0,
          documentsFailed: 1,
          success: true,
          details: { disposition: 'abandoned' },
        },
      );
      return;
    }
    appContext.logger.info(
      MODULE_NAME,
      `Error encountered attempting to sync ${event.caseId}: ${event.error['message']}.`,
    );
    delete event.error;
    appContext.extraOutputs.set(RETRY, [event]);
    completeDataflowTrace(
      appContext.observability,
      trace,
      MODULE_NAME,
      'handleError',
      appContext.logger,
      {
        documentsWritten: 0,
        documentsFailed: 1,
        success: true,
        details: { disposition: 'queued-for-retry' },
      },
    );
  } catch (error) {
    logger.error(MODULE_NAME, 'Failed in handleError', error);
    throw error;
  }
}

async function handleRetry(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);

  try {
    const appContext = await ContextCreator.getApplicationContext({
      invocationContext,
      logger,
    });
    const trace = appContext.observability.startTrace(appContext.invocationId);

    const RETRY_LIMIT = 3;
    if (!event.retryCount) {
      event.retryCount = 1;
    } else {
      event.retryCount += 1;
    }

    if (event.retryCount > RETRY_LIMIT) {
      appContext.extraOutputs.set(HARD_STOP, [event]);
      appContext.logger.info(
        MODULE_NAME,
        `Too many attempts to sync ${filterToExtendedAscii(event.caseId)}.`,
      );
      completeDataflowTrace(
        appContext.observability,
        trace,
        MODULE_NAME,
        'handleRetry',
        appContext.logger,
        {
          documentsWritten: 0,
          documentsFailed: 1,
          success: true,
          details: { disposition: 'hard-stop', retryCount: String(event.retryCount) },
        },
      );
    } else {
      if (!event.bCase) {
        const exportResult = await ExportAndLoadCase.exportCase(appContext, event);

        if (exportResult.bCase) {
          event.bCase = exportResult.bCase;
        } else {
          event.error =
            exportResult.error ??
            new UnknownError(MODULE_NAME, { message: 'Expected case detail was not returned.' });
          appContext.extraOutputs.set(DLQ, [event]);
          completeDataflowTrace(
            appContext.observability,
            trace,
            MODULE_NAME,
            'handleRetry',
            appContext.logger,
            {
              documentsWritten: 0,
              documentsFailed: 1,
              success: true,
              details: { disposition: 'export-failed', retryCount: String(event.retryCount) },
            },
          );
          return;
        }
      }

      const loadResult = await ExportAndLoadCase.loadCase(appContext, event);

      if (loadResult.error) {
        event.error = loadResult.error;
        appContext.extraOutputs.set(DLQ, [event]);
        completeDataflowTrace(
          appContext.observability,
          trace,
          MODULE_NAME,
          'handleRetry',
          appContext.logger,
          {
            documentsWritten: 0,
            documentsFailed: 1,
            success: true,
            details: { disposition: 'load-failed', retryCount: String(event.retryCount) },
          },
        );
      } else {
        appContext.logger.info(
          MODULE_NAME,
          `Successfully retried to sync ${filterToExtendedAscii(event.caseId)}.`,
        );
        completeDataflowTrace(
          appContext.observability,
          trace,
          MODULE_NAME,
          'handleRetry',
          appContext.logger,
          {
            documentsWritten: 1,
            documentsFailed: 0,
            success: true,
            details: { disposition: 'retry-succeeded', retryCount: String(event.retryCount) },
          },
        );
      }
    }
  } catch (error) {
    logger.error(MODULE_NAME, 'Failed in handleRetry', error);
    throw error;
  }
}

/**
 * loadMigrationTable
 *
 * @param appContext
 * @returns
 */
async function loadMigrationTable(appContext: ApplicationContext) {
  const result = await MigrateCases.loadMigrationTable(appContext);
  if (result.error) {
    appContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, LOAD_MIGRATION_TABLE),
    );
  }
  return result.data;
}

/**
 * emptyMigrationTable
 *
 * @param appContext
 */
async function emptyMigrationTable(appContext: ApplicationContext) {
  const result = await MigrateCases.emptyMigrationTable(appContext);
  if (result.error) {
    appContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, EMPTY_MIGRATION_TABLE),
    );
    return false;
  }
  return true;
}

/**
 * getCaseIdsToMigrate
 *
 * @param params
 * @param appContext
 * @returns
 */
async function getCaseIdsToMigrate(
  params: {
    start: number;
    end: number;
  },
  appContext: ApplicationContext,
): Promise<CaseSyncEvent[]> {
  const { start, end } = params;
  const result = await MigrateCases.getPageOfCaseEvents(appContext, start, end);

  if (result.error) {
    appContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, GET_CASEIDS_TO_MIGRATE),
    );
    return [];
  }

  return result.events;
}

/**
 * storeRuntimeState
 *
 * Wrapper for CasesRuntimeState.storeRuntimeState
 *
 * @param appContext
 * @param syncDate
 * @returns
 */
async function storeRuntimeState(appContext: ApplicationContext, syncDate: string) {
  return CasesRuntimeState.storeRuntimeState(appContext, syncDate, syncDate);
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
    route: 'migrate-cases',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export default {
  MODULE_NAME,
  setup,
};
