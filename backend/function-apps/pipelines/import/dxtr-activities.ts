import { InvocationContext } from '@azure/functions';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import ContextCreator from '../../azure/application-context-creator';
import { DxtrCaseChangeEvent } from './import-pipeline-types';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { DxtrCase } from '../../../../common/src/cams/cases';

const MODULE_NAME = 'IMPORT-PIPELINE-DXTR-ACTIVITIES';

/**
 * exportCaseChangeEvents
 *
 * Export caseIds when changes appear in AO_CS, AO_TX, etc.
 */
async function exportCaseChangeEvents(): Promise<DxtrCaseChangeEvent[]> {
  const events: DxtrCaseChangeEvent[] = [];

  // Query DXTR
  events.push({ type: '', caseId: '081-73-34831' });
  events.push({ type: '', caseId: '081-14-41751' });

  return events;
}

/**
 * exportCaseSummary
 *
 * Export case detail we intend on storing in Cosmos
 */
async function exportCase(
  event: DxtrCaseChangeEvent,
  invocationContext: InvocationContext,
): Promise<DxtrCase | undefined> {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });

  try {
    const useCase = new CaseManagement(context);
    const bCase = await useCase.getDxtrCase(context, event.caseId);

    return bCase;
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed while exporting case ${event.caseId}.`,
    );
    logger.camsError(error);
  }
}

const DxtrActivities = {
  exportCaseChangeEvents,
  exportCase,
};

export default DxtrActivities;
