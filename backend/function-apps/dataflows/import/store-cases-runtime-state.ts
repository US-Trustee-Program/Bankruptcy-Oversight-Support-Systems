import { InvocationContext } from '@azure/functions';

import ContextCreator from '../../azure/application-context-creator';

import { DLQ } from '../dataflows-queues';
import CasesRuntimeState from '../../../lib/use-cases/dataflows/cases-runtime-state';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';

const MODULE_NAME = 'STORE_CASES_RUNTIME_STATE';

export /**
 * storeCasesRuntimeState
 *
 * @param params The lastTxId if it exists and the calling activity name
 * @param invocationContext
 */
async function storeCasesRuntimeState(
  params: { lastTxId?: string; activityName: string },
  invocationContext: InvocationContext,
) {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  try {
    await CasesRuntimeState.storeRuntimeState(context, params.lastTxId);
  } catch (originalError) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, params.activityName),
    );
    return false;
  }
  return true;
}
