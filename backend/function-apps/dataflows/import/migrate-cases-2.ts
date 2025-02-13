import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { app, HttpRequest, HttpResponse, InvocationContext, output } from '@azure/functions';

import { CaseSyncEvent, getDefaultSummary } from '../../../../common/src/queue/dataflow-types';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';

import ContextCreator from '../../azure/application-context-creator';
import { toAzureError } from '../../azure/functions';
import { buildUniqueName, isAuthorized } from '../dataflows-common';
import { STORE_CASES_RUNTIME_STATE } from './store-cases-runtime-state';
import MigrateCases from '../../../lib/use-cases/dataflows/migrate-cases';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';

const MODULE_NAME = 'MIGRATE_CASES_2';

// Queues
export const DLQ = output.storageQueue({
  queueName: buildUniqueName(MODULE_NAME, 'dlq'),
  connection: 'AzureWebJobsStorage',
});

export const ETL = output.storageQueue({
  queueName: buildUniqueName(MODULE_NAME, 'etl'),
  connection: 'AzureWebJobsStorage',
});

// Orchestration Aliases
const MIGRATE_CASES = buildUniqueName(MODULE_NAME, 'migrateCases');
const PARTITION_CASEIDS = buildUniqueName(MODULE_NAME, 'partitionCaseIds');

// Activity Aliases
const GET_CASEIDS_TO_MIGRATE_ACTIVITY = buildUniqueName(MODULE_NAME, 'getCaseIdsToMigrate');
const LOAD_MIGRATION_TABLE_ACTIVITY = buildUniqueName(MODULE_NAME, 'loadMigrationTable');
const EMPTY_MIGRATION_TABLE_ACTIVITY = buildUniqueName(MODULE_NAME, 'emptyMigrationTable');
const ADD_TO_ETL_ACTIVITY = buildUniqueName(MODULE_NAME, 'addToETL');

/**
 * addToETL
 *
 * @param events
 * @param invocationContext
 * @returns
 */
async function addToETL(events: CaseSyncEvent[], invocationContext: InvocationContext) {
  try {
    for (const event of events) {
      invocationContext.extraOutputs.set(ETL, event);
    }
  } catch (originalError) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, LOAD_MIGRATION_TABLE_ACTIVITY),
    );
  }
}

/**
 * processETL
 *
 * @param event
 * @param invocationContext
 * @returns
 */
async function processETL(event: CaseSyncEvent, invocationContext: InvocationContext) {
  try {
    const context = await ContextCreator.getApplicationContext({ invocationContext });

    const exportedCaseEvent = await ExportAndLoadCase.exportCase(context, event);
    if (exportedCaseEvent.error) throw exportedCaseEvent.error;

    const loadedCaseEvent = await ExportAndLoadCase.loadCase(context, exportedCaseEvent);
    if (loadedCaseEvent.error) throw loadedCaseEvent.error;

    return event;
  } catch (originalError) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, LOAD_MIGRATION_TABLE_ACTIVITY),
    );
  }
}

/**
 * loadMigrationTable
 *
 * @param _ignore
 * @param invocationContext
 * @returns
 */
async function loadMigrationTable(_ignore: unknown, invocationContext: InvocationContext) {
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
 * partitionCaseIds
 *
 * @param context
 */
function* partitionCaseIds(context: OrchestrationContext) {
  const count: number = context.df.getInput();

  const partitionSize = 1000;

  let start = 0;
  let end = 0;

  while (end < count) {
    start = end + 1;
    end += partitionSize;

    const events: CaseSyncEvent[] = yield context.df.callActivity(GET_CASEIDS_TO_MIGRATE_ACTIVITY, {
      start,
      end,
    });

    yield context.df.callActivity(ADD_TO_ETL_ACTIVITY, events);
  }
}

/**
 * emptyMigrationTable
 *
 * @param _ignore
 * @param invocationContext
 */
async function emptyMigrationTable(_ignore: unknown, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const result = await MigrateCases.emptyMigrationTable(context);
  if (result.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, EMPTY_MIGRATION_TABLE_ACTIVITY),
    );
  }
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
 * migrateCases
 *
 * Get case Ids from ACMS identifying cases to migrate then export and load the cases from DXTR into CAMS.
 *
 * @param  context
 */
function* migrateCases(context: OrchestrationContext) {
  yield context.df.callActivity(EMPTY_MIGRATION_TABLE_ACTIVITY);
  const count = yield context.df.callActivity(LOAD_MIGRATION_TABLE_ACTIVITY);

  if (count === 0) {
    return getDefaultSummary({ changedCases: count });
  }

  const childId = context.df.instanceId + `:${PARTITION_CASEIDS}`;
  const summary = yield context.df.callSubOrchestrator(PARTITION_CASEIDS, count, childId);

  yield context.df.callSubOrchestrator(
    STORE_CASES_RUNTIME_STATE,
    {},
    context.df.instanceId + `:${MIGRATE_CASES}:${STORE_CASES_RUNTIME_STATE}`,
  );
  yield context.df.callActivity(EMPTY_MIGRATION_TABLE_ACTIVITY);

  return summary;
}

/**
 * migrateCasesHttpTrigger
 *
 * @param request
 * @param context
 * @returns
 */
async function migrateCasesHttpTrigger(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  try {
    if (!isAuthorized(request)) {
      throw new ForbiddenError(MODULE_NAME);
    }
    const client = df.getClient(context);
    const instanceId: string = await client.startNew(MIGRATE_CASES);

    return client.createCheckStatusResponse(request, instanceId);
  } catch (error) {
    return new HttpResponse(toAzureError(ContextCreator.getLogger(context), MODULE_NAME, error));
  }
}

export function setupMigrateCases2() {
  df.app.orchestration(MIGRATE_CASES, migrateCases);
  df.app.orchestration(PARTITION_CASEIDS, partitionCaseIds);

  df.app.activity(GET_CASEIDS_TO_MIGRATE_ACTIVITY, {
    handler: getCaseIdsToMigrate,
  });

  df.app.activity(LOAD_MIGRATION_TABLE_ACTIVITY, {
    handler: loadMigrationTable,
    extraOutputs: [DLQ],
  });

  df.app.activity(EMPTY_MIGRATION_TABLE_ACTIVITY, {
    handler: emptyMigrationTable,
    extraOutputs: [DLQ],
  });

  df.app.activity(ADD_TO_ETL_ACTIVITY, {
    handler: addToETL,
    extraOutputs: [ETL, DLQ],
  });

  app.storageQueue(ETL.queueName, {
    queueName: ETL.queueName,
    connection: 'AzureWebJobsStorage',
    handler: processETL,
    extraOutputs: [DLQ],
  });

  app.http(buildUniqueName(MODULE_NAME, 'httpTrigger'), {
    route: 'migratecases2',
    extraInputs: [df.input.durableClient()],
    handler: migrateCasesHttpTrigger,
  });
}
