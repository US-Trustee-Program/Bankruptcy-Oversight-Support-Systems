import { app, InvocationContext, output } from '@azure/functions';
import { CaseSyncEvent } from '@common/queue/dataflow-types';

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
import DateHelper from '@common/date-helper';
import { STORAGE_QUEUE_CONNECTION } from '../storage-queues';
import { filterToExtendedAscii } from '@common/cams/sanitization';

const MODULE_NAME = 'MIGRATE-CASES';
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
const GET_CASEIDS_TO_MIGRATE = buildFunctionName(MODULE_NAME, 'getCaseIdsToMigrate');
const LOAD_MIGRATION_TABLE = buildFunctionName(MODULE_NAME, 'loadMigrationTable');
const EMPTY_MIGRATION_TABLE = buildFunctionName(MODULE_NAME, 'emptyMigrationTable');

/**
 * handleStart
 *
 * Get case Ids from ACMS identifying cases to migrate then export and load the cases from DXTR into CAMS.
 *
 * @param {object} message
 * @param {InvocationContext} context
 */
async function handleStart(_ignore: StartMessage, context: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(context);
  const migrationStartTimestamp = new Date().toISOString();
  logger.info(
    MODULE_NAME,
    `MIGRATION_CUTOFF_TIMESTAMP=${migrationStartTimestamp} — Use this as cutoffDate for resync-remaining-cases.`,
  );

  const isEmpty = await emptyMigrationTable(context);
  if (!isEmpty) return;

  const count = await loadMigrationTable(context);

  if (count === 0) return;

  let start = 0;
  let end = 0;

  const pages = [];
  while (end < count) {
    start = end + 1;
    end += PAGE_SIZE;
    pages.push({ start, end });
  }
  context.extraOutputs.set(PAGE, pages);

  await storeRuntimeState(context);
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
  const events: CaseSyncEvent[] = await getCaseIdsToMigrate(range, invocationContext);

  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const processedEvents = await ExportAndLoadCase.exportAndLoad(appContext, events);

  const failedEvents = processedEvents.filter((event) => !!event.error);
  invocationContext.extraOutputs.set(DLQ, failedEvents);
}

async function handleError(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const logger = ApplicationContextCreator.getLogger(invocationContext);
  if (isNotFoundError(event.error)) {
    logger.info(MODULE_NAME, `Abandoning attempt to sync ${event.caseId}: ${event.error.message}.`);
    return;
  }
  logger.info(
    MODULE_NAME,
    `Error encountered attempting to sync ${event.caseId}: ${event.error['message']}.`,
  );
  delete event.error;
  invocationContext.extraOutputs.set(RETRY, [event]);
}

async function handleRetry(event: CaseSyncEvent, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const { logger } = context;

  const RETRY_LIMIT = 3;
  if (!event.retryCount) {
    event.retryCount = 1;
  } else {
    event.retryCount += 1;
  }

  if (event.retryCount > RETRY_LIMIT) {
    invocationContext.extraOutputs.set(HARD_STOP, [event]);
    logger.info(MODULE_NAME, `Too many attempts to sync ${filterToExtendedAscii(event.caseId)}.`);
  } else {
    if (!event.bCase) {
      const exportResult = await ExportAndLoadCase.exportCase(context, event);

      if (exportResult.bCase) {
        event.bCase = exportResult.bCase;
      } else {
        event.error =
          exportResult.error ??
          new UnknownError(MODULE_NAME, { message: 'Expected case detail was not returned.' });
        invocationContext.extraOutputs.set(DLQ, [event]);
        return;
      }
    }

    const loadResult = await ExportAndLoadCase.loadCase(context, event);

    if (loadResult.error) {
      event.error = loadResult.error;
      invocationContext.extraOutputs.set(DLQ, [event]);
    }

    logger.info(
      MODULE_NAME,
      `Successfully retried to sync ${filterToExtendedAscii(event.caseId)}.`,
    );
  }
}

/**
 * loadMigrationTable
 *
 * @param invocationContext
 * @returns
 */
async function loadMigrationTable(invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const result = await MigrateCases.loadMigrationTable(context);
  if (result.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, LOAD_MIGRATION_TABLE),
    );
  }
  return result.data;
}

/**
 * emptyMigrationTable
 *
 * @param invocationContext
 */
async function emptyMigrationTable(invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const result = await MigrateCases.emptyMigrationTable(context);
  if (result.error) {
    invocationContext.extraOutputs.set(
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
 * @param invocationContext
 * @returns
 */
async function getCaseIdsToMigrate(
  params: {
    start: number;
    end: number;
  },
  invocationContext: InvocationContext,
): Promise<CaseSyncEvent[]> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });

  const { start, end } = params;
  const result = await MigrateCases.getPageOfCaseEvents(context, start, end);

  if (result.error) {
    invocationContext.extraOutputs.set(
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
 * @param invocationContext
 * @returns
 */
async function storeRuntimeState(invocationContext: InvocationContext) {
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  return CasesRuntimeState.storeRuntimeState(appContext, DateHelper.getTodaysIsoDate());
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
