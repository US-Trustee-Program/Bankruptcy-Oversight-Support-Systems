import { InvocationContext } from '@azure/functions';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { CaseSyncEvent } from './import-dataflow-types';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { DLQ } from './import-dataflow-queues';
import ContextCreator from '../../azure/application-context-creator';

const MODULE_NAME = 'IMPORT-DATAFLOW-DXTR-ACTIVITIES';

/**
 * getCaseIdsToSync
 *
 * Export caseIds when changes appear in AO_CS, AO_TX, etc.
 *
 * @returns {CaseSyncEvent[]}
 */
async function getCaseIdsToSync(
  _ignore: unknown,
  invocationContext: InvocationContext,
): Promise<CaseSyncEvent[]> {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });
  const useCase = new CaseManagement(context);
  try {
    const results = await useCase.getCaseIdsToSync(context);
    const events: CaseSyncEvent[] = results.map((caseId) => {
      return { type: 'CASE_CHANGED', caseId };
    });
    return events;
  } catch (error) {
    context.logger.camsError(error);
    return [];
  }
}

/**
 * exportCaseSummary
 *
 * Export case detail we intend on storing in Cosmos
 *
 * @param {CaseSyncEvent} event
 * @param {InvocationContext} invocationContext
 * @returns {CaseSyncEvent}
 */
async function exportCase(
  event: CaseSyncEvent,
  invocationContext: InvocationContext,
): Promise<CaseSyncEvent> {
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
    context.logger.camsError(error);
    event.error = error;
    invocationContext.extraOutputs.set(DLQ, event);
  }

  return event;
}

const DxtrActivities = {
  getCaseIdsToSync,
  exportCase,
};

export default DxtrActivities;
