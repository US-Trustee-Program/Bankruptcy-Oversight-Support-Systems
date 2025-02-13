import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { app, HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';

import {
  CaseSyncEvent,
  ExportCaseChangeEventsSummary,
  getDefaultSummary,
} from '../../../../common/src/queue/dataflow-types';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';

import ContextCreator from '../../azure/application-context-creator';
import { toAzureError } from '../../azure/functions';
import { buildUniqueName, isAuthorized } from '../dataflows-common';
import { STORE_CASES_RUNTIME_STATE } from './store-cases-runtime-state';
import MigrateCases from '../../../lib/use-cases/dataflows/migrate-cases';
import { DLQ } from '../dataflows-queues';
import { EXPORT_AND_LOAD_CASE } from './export-and-load-case';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';

const MODULE_NAME = 'MIGRATE_CASES_DATAFLOW';

// Orchestration Aliases
const MIGRATE_CASES = buildUniqueName(MODULE_NAME, 'migrateCases');
const PARTITION_CASEIDS = buildUniqueName(MODULE_NAME, 'partitionCaseIds');
const MIGRATE_PARTITION = buildUniqueName(MODULE_NAME, 'migratePartition');

// Activity Aliases
const GET_CASEIDS_TO_MIGRATE_ACTIVITY = buildUniqueName(MODULE_NAME, 'getCaseIdsToMigrateActivity');
const LOAD_MIGRATION_TABLE = buildUniqueName(MODULE_NAME, 'loadMigrationTable');
const EMPTY_MIGRATION_TABLE = buildUniqueName(MODULE_NAME, 'emptyMigrationTable');

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
      buildQueueError(result.error, MODULE_NAME, LOAD_MIGRATION_TABLE),
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

  const finalSummary = getDefaultSummary();
  const partitionSize = 1000;

  let start = 0;
  let end = 0;
  let partitionCount = 0;

  while (end < count) {
    partitionCount += 1;
    start = end + 1;
    end += partitionSize;
    const task = yield context.df.callSubOrchestrator(
      MIGRATE_PARTITION,
      { start, end },
      context.df.instanceId + `:${MIGRATE_CASES}:partition:${partitionCount}`,
    );

    if (task.result) {
      const result = task.result as ExportCaseChangeEventsSummary;
      finalSummary.changedCases += result.changedCases;
      finalSummary.exportedAndLoaded += result.exportedAndLoaded;
      finalSummary.completed += result.completed;
      finalSummary.errors += result.errors;
      finalSummary.faulted += result.faulted;
      finalSummary.noResult += result.noResult;
    }
  }

  return finalSummary;
}

function* migratePartition(context: OrchestrationContext) {
  const range = context.df.getInput();

  const events: CaseSyncEvent[] = yield context.df.callActivity(
    GET_CASEIDS_TO_MIGRATE_ACTIVITY,
    range,
  );

  const nextTasks: df.Task[] = [];

  for (const event of events) {
    const childId = context.df.instanceId + `:${EXPORT_AND_LOAD_CASE}:${event.caseId}:`;
    nextTasks.push(context.df.callSubOrchestrator(EXPORT_AND_LOAD_CASE, event, childId));
  }

  yield context.df.Task.all(nextTasks);

  const results = nextTasks.reduce(
    (summary, task) => {
      if (task.isCompleted) {
        summary.completed += 1;
      }
      if (task.isFaulted) {
        summary.faulted += 1;
      }
      if (task.result) {
        const event = task.result as unknown as CaseSyncEvent;
        if (event.error) {
          summary.errors += 1;
        } else {
          summary.exportedAndLoaded += 1;
        }
      } else {
        summary.noResult += 1;
      }

      return summary;
    },
    getDefaultSummary({ changedCases: events.length }),
  );

  return results;
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
      buildQueueError(result.error, MODULE_NAME, EMPTY_MIGRATION_TABLE),
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
  yield context.df.callActivity(EMPTY_MIGRATION_TABLE);
  const count = yield context.df.callActivity(LOAD_MIGRATION_TABLE);

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
  yield context.df.callActivity(EMPTY_MIGRATION_TABLE);

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

export function setupMigrateCases() {
  df.app.orchestration(MIGRATE_CASES, migrateCases);
  df.app.orchestration(PARTITION_CASEIDS, partitionCaseIds);
  df.app.orchestration(MIGRATE_PARTITION, migratePartition);

  df.app.activity(GET_CASEIDS_TO_MIGRATE_ACTIVITY, {
    handler: getCaseIdsToMigrate,
  });

  df.app.activity(LOAD_MIGRATION_TABLE, {
    handler: loadMigrationTable,
    extraOutputs: [DLQ],
  });

  df.app.activity(EMPTY_MIGRATION_TABLE, { handler: emptyMigrationTable, extraOutputs: [DLQ] });

  app.http('migrateCasesHttpTrigger', {
    route: 'migratecases',
    extraInputs: [df.input.durableClient()],
    handler: migrateCasesHttpTrigger,
  });
}
