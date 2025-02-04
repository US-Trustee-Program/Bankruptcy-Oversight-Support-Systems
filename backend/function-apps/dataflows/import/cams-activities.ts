import { InvocationContext } from '@azure/functions';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { CaseSyncEvent } from './import-dataflow-types';
import { DLQ } from './import-dataflow-queues';
import ContextCreator from '../../azure/application-context-creator';
import { BadRequestError } from '../../../lib/common-errors/bad-request';

const MODULE_NAME = 'IMPORT-DATAFLOW-CAMS-ACTIVITIES';

/**
 * loadCase
 *
 * Load case details into Cosmos
 *
 * @param {CaseSyncEvent} event
 * @param {InvocationContext} invocationContext
 * @returns {CaseSyncEvent}
 */
async function loadCase(
  event: CaseSyncEvent,
  invocationContext: InvocationContext,
): Promise<CaseSyncEvent> {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });

  if (event.error) return event;
  if (!event.bCase) {
    event.error = new BadRequestError(MODULE_NAME, { message: 'No case to load.' });
    return event;
  }

  try {
    const useCase = new CaseManagement(context);
    await useCase.syncCase(context, event.bCase);
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed while syncing case ${event.caseId}.`,
    );
    context.logger.camsError(error);
    event.error = error;
    invocationContext.extraOutputs.set(DLQ, event);
  }

  return event;
}

async function storeRuntimeState(
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

const CamsActivities = {
  loadCase,
  storeRuntimeState,
};

export default CamsActivities;
