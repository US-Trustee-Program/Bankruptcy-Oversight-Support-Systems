import { InvocationContext } from '@azure/functions';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { CaseSyncEvent } from './import-dataflow-types';
import DataflowsCommon from '../dataflows-common';
import { DLQ } from './import-dataflow-queues';

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
  const context = await DataflowsCommon.getApplicationContext(invocationContext);

  if (event.error) return event;
  if (!event.bCase) {
    event.error = new Error('No case to load.');
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

const CamsActivities = {
  loadCase,
};

export default CamsActivities;
