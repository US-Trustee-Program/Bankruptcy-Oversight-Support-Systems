import { InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { DxtrCaseChangeEvent } from './import-pipeline-types';

const MODULE_NAME = 'IMPORT-PIPELINE-CAMS-ACTIVITIES';

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
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });

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
    logger.camsError(error);
    event.error = error;
  }

  return event;
}

const CamsActivities = {
  loadCase,
};

export default CamsActivities;
