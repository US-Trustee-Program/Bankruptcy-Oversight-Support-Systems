import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { app, HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';

import { CaseSyncEvent, getDefaultSummary } from '../../../lib/use-cases/dataflows/dataflow-types';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';
import AcmsOrders from '../../../lib/use-cases/acms-orders/acms-orders';

import ContextCreator from '../../azure/application-context-creator';
import { toAzureError } from '../../azure/functions';
import { isAuthorized } from '../dataflows-common';
import { STORE_CASES_RUNTIME_STATE } from './store-cases-runtime-state';

const MODULE_NAME = 'MIGRATE_CASES_DATAFLOW';

// Orchestration Aliases
export const MIGRATE_CASES = 'migrateCases';

// Activity Aliases
const ACMS_GET_CASEIDS_TO_MIGRATE_ACTIVITY = 'acmsGetCaseIdsToMigrateActivity';

/**
 * getCaseIdsToMigrate
 *
 * Export caseIds from ACMS to migrate from DXTR to CAMS.
 *
 * @returns {CaseSyncEvent[]}
 */
async function getCaseIdsToMigrate(
  _ignore: unknown,
  invocationContext: InvocationContext,
): Promise<CaseSyncEvent[]> {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const useCase = new AcmsOrders();
  try {
    const results = await useCase.getCaseIdsToMigrate(context);
    const events: CaseSyncEvent[] = results.map((caseId) => {
      return { type: 'MIGRATION', caseId };
    });
    return events;
  } catch (error) {
    context.logger.camsError(error);
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
    handler: getCaseIdsToMigrate,
  });

  app.http('acmsMigrationHttpTrigger', {
    route: 'acmsmigration',
    extraInputs: [df.input.durableClient()],
    handler: acmsMigrationHttpTrigger,
  });
}
