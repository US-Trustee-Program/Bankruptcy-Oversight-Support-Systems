import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { app, HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';

import {
  buildQueueError,
  CaseSyncEvent,
  ExportCaseChangeEventsSummary,
  getDefaultSummary,
} from '../../../lib/use-cases/dataflows/dataflow-types';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';

import ContextCreator from '../../azure/application-context-creator';
import { toAzureError } from '../../azure/functions';
import { buildUniqueName, isAuthorized } from '../dataflows-common';
import { STORE_CASES_RUNTIME_STATE } from './store-cases-runtime-state';
import MigrateCases from '../../../lib/use-cases/dataflows/migrate-cases';
import { DLQ } from '../dataflows-queues';
import { EXPORT_AND_LOAD_CASE } from './export-and-load-case';

const MODULE_NAME = 'MIGRATE_CASES_DATAFLOW';

// Orchestration Aliases
const MIGRATE_CASES = buildUniqueName(MODULE_NAME, 'migrateCases');
const PARTITION_CASEIDS = buildUniqueName(MODULE_NAME, 'partitionCaseIds');
const MIGRATE_PARTITION = buildUniqueName(MODULE_NAME, 'migratePartition');

// Activity Aliases
const GET_CASEIDS_TO_MIGRATE_ACTIVITY = buildUniqueName(MODULE_NAME, 'getCaseIdsToMigrateActivity');
const CREATE_MIGRATION_TABLE = buildUniqueName(MODULE_NAME, 'createMigrationTable');
const DROP_MIGRATION_TABLE = buildUniqueName(MODULE_NAME, 'dropMigrationTable');

/**
 * createMigrationTable
 *
 * @param _ignore
 * @param invocationContext
 * @returns
 */
async function createMigrationTable(_ignore: unknown, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const result = await MigrateCases.createMigrationTable(context);
  if (result.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, CREATE_MIGRATION_TABLE),
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

  const nextTasks: df.Task[] = [];
  const partitionSize = 10000;
  const partitionCount = Math.ceil(count / partitionSize);
  for (let i = 0; i < partitionCount; i++) {
    const childId = context.df.instanceId + `:${MIGRATE_CASES}:partition:${i}`;
    const start = i * partitionCount;
    const end = i * partitionCount + partitionSize;
    nextTasks.push(context.df.callSubOrchestrator(MIGRATE_PARTITION, { start, end }, childId));
  }

  yield context.df.Task.all(nextTasks);

  const finalSummary = nextTasks.reduce((acc, task) => {
    if (task.result) {
      const result = task.result as ExportCaseChangeEventsSummary;
      acc.changedCases += result.changedCases;
      acc.exportedAndLoaded += result.exportedAndLoaded;
      acc.completed += result.completed;
      acc.errors += result.errors;
      acc.faulted += result.faulted;
      acc.noResult += result.noResult;
    }
    return acc;
  }, getDefaultSummary());

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
 * dropMigrationTable
 *
 * @param _ignore
 * @param invocationContext
 */
async function dropMigrationTable(_ignore: unknown, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const result = await MigrateCases.dropMigrationTable(context);
  if (result.error) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(result.error, MODULE_NAME, DROP_MIGRATION_TABLE),
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
  const result = await MigrateCases.getPageOfCaseIds(context, start, end);

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
  const count = yield context.df.callActivity(CREATE_MIGRATION_TABLE);

  if (count === 0) {
    return getDefaultSummary({ changedCases: count });
  }

  const childId = context.df.instanceId + `:${PARTITION_CASEIDS}`;
  const summary = context.df.callSubOrchestrator(PARTITION_CASEIDS, count, childId);

  yield context.df.callSubOrchestrator(
    STORE_CASES_RUNTIME_STATE,
    {},
    context.df.instanceId + `:${MIGRATE_CASES}:${STORE_CASES_RUNTIME_STATE}`,
  );
  yield context.df.callActivity(DROP_MIGRATION_TABLE);

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

  df.app.activity(CREATE_MIGRATION_TABLE, {
    handler: createMigrationTable,
    extraOutputs: [DLQ],
  });

  df.app.activity(DROP_MIGRATION_TABLE, { handler: dropMigrationTable, extraOutputs: [DLQ] });

  app.http('migrateCasesHttpTrigger', {
    route: 'migratecases',
    extraInputs: [df.input.durableClient()],
    handler: migrateCasesHttpTrigger,
  });
}
