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
 */
async function loadCase(event: DxtrCaseChangeEvent, invocationContext: InvocationContext) {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });

  try {
    if (event.error || !event.bCase) {
      throw new Error('got nothing to save to cosmos, man!');
    }
    const useCase = new CaseManagement(context);
    await useCase.syncCase(context, event.bCase);
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed while syncing case ${event.caseId}.`,
    );
    logger.camsError(error);
  }
}

const CamsActivities = {
  loadCase,
};

export default CamsActivities;
