import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { app, HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';

import { CaseSyncEvent, getDefaultSummary } from '../../../lib/use-cases/dataflows/dataflow-types';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';

import ContextCreator from '../../azure/application-context-creator';
import { toAzureError } from '../../azure/functions';
import { isAuthorized } from '../dataflows-common';
import { STORE_CASES_RUNTIME_STATE } from './store-cases-runtime-state';
import MigrateCases from '../../../lib/use-cases/dataflows/migrate-cases';

const MODULE_NAME = 'MIGRATE_CASES_DATAFLOW';

// Orchestration Aliases
export const MIGRATE_CASES = 'migrateCases';

// Activity Aliases
const ACMS_GET_CASEIDS_TO_MIGRATE_ACTIVITY = 'acmsGetCaseIdsToMigrateActivity';
const CREATE_TEMP_TABLE_ACTIVITY = 'createTempTableActivity';
const DROP_TEMP_TABLE_ACTIVITY = 'dropTempTableActivity';

async function createMigrationTable(_ignore: unknown, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const result = await MigrateCases.createMigrationTable(context);
  if (result.error) {
    // write to DLQ
  }
  // TODO: return the recordset size
}

async function dropMigrationTable(_ignore: unknown, invocationContext: InvocationContext) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const result = await MigrateCases.dropMigrationTable(context);
  if (result.error) {
    // write to DLQ
  }
}

async function getPageOfCaseIds(
  _ignore: unknown,
  invocationContext: InvocationContext,
): Promise<CaseSyncEvent[]> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });

  // TODO: we need to pass in the start and end.
  const results = await MigrateCases.getPageOfCaseIds(context, 0, 0);

  if (results.error) {
    // write to dlq
    return [];
  }

  if (results.caseIds) {
    return results.caseIds.map((caseId) => {
      return {
        type: 'MIGRATION',
        caseId,
      };
    });
  } else {
    return [];
  }
}

/**
 * acmsMigration
 *
 * Get case Ids from ACMS identifying cases to migrate then export and load the cases from DXTR into CAMS.
 *
 * @param  context
 */
function* acmsMigration(context: OrchestrationContext) {
  // TODO: This needs to be implemented to handle large data set from SQL server
  yield context.df.callActivity(CREATE_TEMP_TABLE_ACTIVITY);
  const count = 4666928;
  for (let i = 0; i < Math.ceil(count / 1000); i++) {
    // get next 1000 case ids
  }

  const events: CaseSyncEvent[] = yield context.df.callActivity(
    ACMS_GET_CASEIDS_TO_MIGRATE_ACTIVITY,
  );
  const summary = getDefaultSummary({ changedCases: events.length });

  const _child_id = context.df.instanceId + `:${MIGRATE_CASES}`;

  yield context.df.callSubOrchestrator(
    STORE_CASES_RUNTIME_STATE,
    {},
    context.df.instanceId + `:${MIGRATE_CASES}:${STORE_CASES_RUNTIME_STATE}`,
  );
  yield context.df.callActivity(DROP_TEMP_TABLE_ACTIVITY);

  return summary;
}

/**
 * acmsMigrationHttpTrigger
 *
 * @param request
 * @param context
 * @returns
 */
async function acmsMigrationHttpTrigger(
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
  df.app.orchestration(MIGRATE_CASES, acmsMigration);

  df.app.activity(ACMS_GET_CASEIDS_TO_MIGRATE_ACTIVITY, {
    handler: getPageOfCaseIds,
  });

  df.app.activity(CREATE_TEMP_TABLE_ACTIVITY, { handler: createMigrationTable });

  df.app.activity(DROP_TEMP_TABLE_ACTIVITY, { handler: dropMigrationTable });

  app.http('migrateCasesHttpTrigger', {
    route: 'migratecases',
    extraInputs: [df.input.durableClient()],
    handler: acmsMigrationHttpTrigger,
  });
}
