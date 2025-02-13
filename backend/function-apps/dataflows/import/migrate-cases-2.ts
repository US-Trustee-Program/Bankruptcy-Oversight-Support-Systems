import { app, HttpRequest, HttpResponse, InvocationContext, output } from '@azure/functions';

import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';

import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { buildUniqueName, isAuthorized } from '../dataflows-common';
import MigrateCases from '../../../lib/use-cases/dataflows/migrate-cases';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import CasesRuntimeState from '../../../lib/use-cases/dataflows/cases-runtime-state';

const MODULE_NAME = 'MIGRATE_CASES_2';

// Queues
const DLQ = output.storageQueue({
  queueName: buildUniqueName(MODULE_NAME, 'dlq').toLowerCase(),
  connection: 'AzureWebJobsStorage',
});

const ETL = output.storageQueue({
  queueName: buildUniqueName(MODULE_NAME, 'etl').toLowerCase(),
  connection: 'AzureWebJobsStorage',
});

// Activity Aliases
const GET_CASEIDS_TO_MIGRATE_ACTIVITY = buildUniqueName(MODULE_NAME, 'getCaseIdsToMigrate');
const LOAD_MIGRATION_TABLE_ACTIVITY = buildUniqueName(MODULE_NAME, 'loadMigrationTable');
const EMPTY_MIGRATION_TABLE_ACTIVITY = buildUniqueName(MODULE_NAME, 'emptyMigrationTable');
const STORE_CASES_RUNTIME_STATE = buildUniqueName(MODULE_NAME, 'storeCasesRuntimeState');
const ADD_TO_ETL = buildUniqueName(MODULE_NAME, 'addToETL');
const PROCESS_ETL = buildUniqueName(MODULE_NAME, 'processETL');

/**
 * addToETL
 *
 * @param events
 * @param context
 * @returns
 */
async function addToETL(events: CaseSyncEvent[], context: InvocationContext) {
  try {
    for (const event of events) {
      context.extraOutputs.set(ETL, event);
    }
    return true;
  } catch (originalError) {
    context.extraOutputs.set(DLQ, buildQueueError(originalError, MODULE_NAME, ADD_TO_ETL));
    return false;
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
      buildQueueError(originalError, MODULE_NAME, PROCESS_ETL),
    );
  }
}

/**
 * storeCasesRuntimeState
 *
 * @param params
 * @param invocationContext
 */
async function storeCasesRuntimeState(
  params: { lastTxId?: string },
  invocationContext: InvocationContext,
) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  try {
    await CasesRuntimeState.storeRuntimeState(context, params.lastTxId);
  } catch (originalError) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, STORE_CASES_RUNTIME_STATE),
    );
    return false;
  }
  return true;
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
 * migrateCases
 *
 * Get case Ids from ACMS identifying cases to migrate then export and load the cases from DXTR into CAMS.
 *
 * @param  context
 */
async function migrateCases(_ignore: unknown, context: InvocationContext) {
  const isEmpty = await emptyMigrationTable(undefined, context);
  if (!isEmpty) return;

  const count = await loadMigrationTable(undefined, context);

  if (count === 0) return;

  const partitionSize = 1000;

  let start = 0;
  let end = 0;

  while (end < count) {
    start = end + 1;
    end += partitionSize;

    const events: CaseSyncEvent[] = await getCaseIdsToMigrate(
      {
        start,
        end,
      },
      context,
    );

    const isAdded = await addToETL(events, context);

    if (!isAdded) return;
  }

  await storeCasesRuntimeState(undefined, context);
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
    migrateCases(undefined, context);

    return new HttpResponse(toAzureSuccess({ statusCode: 201 }));
  } catch (error) {
    return new HttpResponse(toAzureError(ContextCreator.getLogger(context), MODULE_NAME, error));
  }
}

export function setupMigrateCases2() {
  app.storageQueue(ETL.queueName, {
    queueName: ETL.queueName,
    connection: 'AzureWebJobsStorage',
    handler: processETL,
    extraOutputs: [DLQ],
  });

  app.http(buildUniqueName(MODULE_NAME, 'httpTrigger'), {
    route: 'migratecases2',
    extraOutputs: [ETL, DLQ],
    handler: httpTrigger,
  });
}
