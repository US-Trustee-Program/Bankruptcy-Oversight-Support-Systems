import { app, InvocationContext, output } from '@azure/functions';
import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';

import ContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  RangeMessage,
  StartMessage,
  STORAGE_QUEUE_CONNECTION,
} from '../dataflows-common';
import MigrateCases from '../../../lib/use-cases/dataflows/migrate-cases';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import CasesRuntimeState from '../../../lib/use-cases/dataflows/cases-runtime-state';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';

const MODULE_NAME = 'MIGRATE_CASES';
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

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
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
async function handleStart(message: StartMessage, context: InvocationContext) {
  if (!message.invocationId) return;

  const logger = ContextCreator.getLogger(context);
  logger.info(MODULE_NAME, `Migrating cases. Invocation id: ${message.invocationId}.`);

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
  return CasesRuntimeState.storeRuntimeState(appContext);
}

export function setupMigrateCases() {
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

  app.http(HTTP_TRIGGER, {
    route: 'migratecases',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}
