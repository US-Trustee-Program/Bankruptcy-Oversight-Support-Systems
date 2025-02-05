import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { InvocationContext } from '@azure/functions';

import ContextCreator from '../../azure/application-context-creator';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { getCamsError } from '../../../lib/common-errors/error-utilities';

import { DLQ } from '../dataflows-queues';

const MODULE_NAME = 'STORE_CASES_RUNTIME_STATE_DATAFLOW';

// Orchestration Aliases
export const STORE_CASES_RUNTIME_STATE = 'storeCasesRuntimeState';

// Activity Aliases
const STORE_CASES_RUNTIME_STATE_ACTIVITY = 'storeCasesRuntimeStateActivity';

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
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });

  try {
    const useCase = new CaseManagement(context);
    await useCase.storeRuntimeState(context, params.lastTxId);
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed while storing the case sync runtime state.`,
    );
    context.logger.camsError(error);
  }
}

/**
 * storeCasesRuntimeState
 *
 * @param  context
 */
function* storeCasesRuntimeState(context: OrchestrationContext) {
  yield context.df.callActivity(STORE_CASES_RUNTIME_STATE, context.df.getInput());
}

export function setupStoreCasesRuntimeState() {
  df.app.orchestration(STORE_CASES_RUNTIME_STATE, storeCasesRuntimeState);

  df.app.activity(STORE_CASES_RUNTIME_STATE_ACTIVITY, {
    handler: storeCasesRuntimeStateActivity,
    extraOutputs: [DLQ],
  });
}
