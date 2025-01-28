import { InvocationContext } from '@azure/functions';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { DxtrCaseChangeEvent } from './import-pipeline-types';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import PipelinesCommmon from '../pipelines-common';

const MODULE_NAME = 'IMPORT-PIPELINE-DXTR-ACTIVITIES';

/**
 * exportCaseChangeEvents
 *
 * Export caseIds when changes appear in AO_CS, AO_TX, etc.
 *
 * @returns {DxtrCaseChangeEvent[]}
 */
async function exportCaseChangeEvents(
  _: unknown,
  invocationContext: InvocationContext,
): Promise<DxtrCaseChangeEvent[]> {
  const context = await PipelinesCommmon.getApplicationContext(invocationContext);
  const useCase = new CaseManagement(context);
  try {
    const results = await useCase.getCaseIdsToSync(context);
    const events: DxtrCaseChangeEvent[] = results.map((caseId) => {
      return { type: '', caseId };
    });
    return events;
  } catch (error) {
    context.logger.camsError(error);
    return [];
  }

  // TODO: Delete these when we are done.
  // events.push({ type: '', caseId: '081-73-34831' });
  // events.push({ type: '', caseId: '081-14-41751' });
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
  const context = await PipelinesCommmon.getApplicationContext(invocationContext);

  try {
    const useCase = new CaseManagement(context);
    event.bCase = await useCase.getDxtrCase(context, event.caseId);
  } catch (originalError) {
    const error = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed while exporting case ${event.caseId}.`,
    );
    context.logger.camsError(error);
    event.error = error;
  }

  return event;
}

const DxtrActivities = {
  exportCaseChangeEvents,
  exportCase,
};

export default DxtrActivities;
