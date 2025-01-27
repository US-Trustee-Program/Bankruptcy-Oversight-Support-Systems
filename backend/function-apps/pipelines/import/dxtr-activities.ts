import { InvocationContext } from '@azure/functions';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import ContextCreator from '../../azure/application-context-creator';
import { DxtrCaseChangeEvent } from './import-pipeline-types';
import { getCamsError } from '../../../lib/common-errors/error-utilities';

const MODULE_NAME = 'IMPORT-PIPELINE-DXTR-ACTIVITIES';

/**
 * exportCaseChangeEvents
 *
 * Export caseIds when changes appear in AO_CS, AO_TX, etc.
 *
 * @returns {DxtrCaseChangeEvent[]}
 */
async function exportCaseChangeEvents(): Promise<DxtrCaseChangeEvent[]> {
  const events: DxtrCaseChangeEvent[] = [];

  events.push({ type: '', caseId: '081-73-34831' });
  events.push({ type: '', caseId: '081-14-41751' });

  // TODO: Load runtime state from Cosmos to get last, greatest AO_TX.TX_ID.
  // TODO: Query DXTR.
  // TODO: Record greatest AO_TX.TX_ID into runtime state.

  return events;
}

/**
 * exportCaseSummary
 *
 * Export case detail we intend on storing in Cosmos
 *
 * @param {DxtrCaseChangeEvent} event
 * @param {InvocationContext} invocationContext
 * @returns {DxtrCaseChangeEvent}
 */
async function exportCase(
  event: DxtrCaseChangeEvent,
  invocationContext: InvocationContext,
): Promise<DxtrCaseChangeEvent> {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });

  try {
    const useCase = new CaseManagement(context);
    event.bCase = await useCase.getDxtrCase(context, event.caseId);
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed while exporting case ${event.caseId}.`,
    );
    logger.camsError(error);
    event.error = error;
  }

  return event;
}

const DxtrActivities = {
  exportCaseChangeEvents,
  exportCase,
};

export default DxtrActivities;
