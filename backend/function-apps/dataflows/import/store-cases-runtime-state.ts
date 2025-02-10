import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { InvocationContext } from '@azure/functions';

import ContextCreator from '../../azure/application-context-creator';

import { DLQ } from '../dataflows-queues';
import CasesRuntimeState from '../../../lib/use-cases/dataflows/cases-runtime-state';
import { buildUniqueName } from '../dataflows-common';

const MODULE_NAME = 'STORE_CASES_RUNTIME_STATE';

// Orchestration Aliases
export const STORE_CASES_RUNTIME_STATE = buildUniqueName(MODULE_NAME, 'storeCasesRuntimeState');

// Activity Aliases
const STORE_CASES_RUNTIME_STATE_ACTIVITY = buildUniqueName(
  MODULE_NAME,
  'storeCasesRuntimeStateActivity',
);

/**
 * storeCasesRuntimeStateActivity
 *
 * @param params
 * @param invocationContext
 */
async function storeCasesRuntimeStateActivity(
  params: { lastTxId?: string },
  invocationContext: InvocationContext,
): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  await CasesRuntimeState.storeRuntimeState(context, params.lastTxId);
}

/**
 * storeCasesRuntimeState
 *
 * @param  context
 */
function* storeCasesRuntimeState(context: OrchestrationContext) {
  yield context.df.callActivity(STORE_CASES_RUNTIME_STATE_ACTIVITY, context.df.getInput());
}

export function setupStoreCasesRuntimeState() {
  df.app.orchestration(STORE_CASES_RUNTIME_STATE, storeCasesRuntimeState);

  df.app.activity(STORE_CASES_RUNTIME_STATE_ACTIVITY, {
    handler: storeCasesRuntimeStateActivity,
    extraOutputs: [DLQ],
  });
}
