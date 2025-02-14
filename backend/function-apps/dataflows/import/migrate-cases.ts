import { app, HttpRequest, HttpResponse, InvocationContext, output } from '@azure/functions';

import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';

import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { buildUniqueName, isAuthorized } from '../dataflows-common';
import MigrateCases from '../../../lib/use-cases/dataflows/migrate-cases';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { storeCasesRuntimeState } from './store-cases-runtime-state';

const MODULE_NAME = 'MIGRATE_CASES';

const PAGE_SIZE = 1000;

// Queues
let START;
let PAGE;
let DLQ;

// Activity Aliases
const GET_CASEIDS_TO_MIGRATE_ACTIVITY = buildUniqueName(MODULE_NAME, 'getCaseIdsToMigrate');
const LOAD_MIGRATION_TABLE_ACTIVITY = buildUniqueName(MODULE_NAME, 'loadMigrationTable');
const EMPTY_MIGRATION_TABLE_ACTIVITY = buildUniqueName(MODULE_NAME, 'emptyMigrationTable');
const STORE_CASES_RUNTIME_STATE = buildUniqueName(MODULE_NAME, 'storeCasesRuntimeState');

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
      buildQueueError(result.error, MODULE_NAME, LOAD_MIGRATION_TABLE_ACTIVITY),
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
      buildQueueError(result.error, MODULE_NAME, EMPTY_MIGRATION_TABLE_ACTIVITY),
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
      buildQueueError(result.error, MODULE_NAME, GET_CASEIDS_TO_MIGRATE_ACTIVITY),
    );
    return [];
  }

  return result.events;
}

/**
 * processPage
 *
 * Get case Ids from ACMS identifying cases to migrate then export and load the cases from DXTR into CAMS.
 *
 * @param range
 * @param invocationContext
 */
async function processPage(
  range: { start: number; end: number },
  invocationContext: InvocationContext,
) {
  const events: CaseSyncEvent[] = await getCaseIdsToMigrate(range, invocationContext);

  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const processedEvents = await MigrateCases.exportAndLoadPage(appContext, events);

  const failedEvents = processedEvents.filter((event) => !!event.error);
  invocationContext.extraOutputs.set(DLQ, failedEvents);
}

/**
 * migrateCases
 *
 * Get case Ids from ACMS identifying cases to migrate then export and load the cases from DXTR into CAMS.
 *
 * @param {object} message
 * @param {InvocationContext} context
 */
async function migrateCases(message: { invocationId: string }, context: InvocationContext) {
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

  await storeCasesRuntimeState({ activityName: STORE_CASES_RUNTIME_STATE }, context);
}

/**
 * httpTrigger
 *
 * @param request
 * @param context
 * @returns
 */
async function httpTrigger(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  try {
    if (!isAuthorized(request)) {
      throw new ForbiddenError(MODULE_NAME);
    }
    context.extraOutputs.set(START, { invocationId: context.invocationId });

    return new HttpResponse(toAzureSuccess({ statusCode: 201 }));
  } catch (error) {
    return new HttpResponse(toAzureError(ContextCreator.getLogger(context), MODULE_NAME, error));
  }
}

export function setupMigrateCases() {
  START = output.storageQueue({
    queueName: buildUniqueName(MODULE_NAME, 'start').toLowerCase(),
    connection: 'AzureWebJobsStorage',
  });

  PAGE = output.storageQueue({
    queueName: buildUniqueName(MODULE_NAME, 'page').toLowerCase(),
    connection: 'AzureWebJobsStorage',
  });

  DLQ = output.storageQueue({
    queueName: buildUniqueName(MODULE_NAME, 'dlq').toLowerCase(),
    connection: 'AzureWebJobsStorage',
  });

  app.storageQueue(buildUniqueName(MODULE_NAME, 'migrateCases'), {
    queueName: START.queueName,
    connection: 'AzureWebJobsStorage',
    handler: migrateCases,
    extraOutputs: [PAGE],
  });

  app.storageQueue(buildUniqueName(MODULE_NAME, 'processPage'), {
    queueName: PAGE.queueName,
    connection: 'AzureWebJobsStorage',
    handler: processPage,
    extraOutputs: [DLQ],
  });

  app.http(buildUniqueName(MODULE_NAME, 'httpTrigger'), {
    methods: ['GET'],
    route: 'migratecases',
    extraOutputs: [START],
    handler: httpTrigger,
  });
}
