import { InvocationContext } from '@azure/functions';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { DxtrCaseChangeEvent } from './import-dataflow-types';
import DataflowsCommmon from '../dataflows-common';

const MODULE_NAME = 'IMPORT-DATAFLOW-CAMS-ACTIVITIES';

/**
 * loadCase
 *
 * Load case details into Cosmos
 *
 * @param {DxtrCaseChangeEvent} event
 * @param {InvocationContext} invocationContext
 * @returns {DxtrCaseChangeEvent}
 */
async function loadCase(
  event: DxtrCaseChangeEvent,
  invocationContext: InvocationContext,
): Promise<DxtrCaseChangeEvent> {
  const context = await DataflowsCommmon.getApplicationContext(invocationContext);

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
  }

  return event;
}

const CamsActivities = {
  loadCase,
};

export default CamsActivities;
