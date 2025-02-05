import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { CaseSyncEvent } from '../../../lib/use-cases/dataflows/dataflow-types';
import { DLQ } from '../dataflows-queues';
import ContextCreator from '../../azure/application-context-creator';
import { InvocationContext } from '@azure/functions';
import { BadRequestError } from '../../../lib/common-errors/bad-request';
import CaseManagement from '../../../lib/use-cases/cases/case-management';
import { getCamsError } from '../../../lib/common-errors/error-utilities';

const MODULE_NAME = 'EXPORT_AND_LOAD_CASE_DATAFLOW';

// Orchestration Aliases
export const EXPORT_AND_LOAD_CASE = 'exportAndLoadCase';

// Activity Aliases
const EXPORT_CASE_ACTIVITY = 'exportCaseActivity';
const LOAD_CASE_ACTIVITY = 'loadCaseActivity';

/**
 * exportCase
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

/**
 * exportAndLoadCase
 *
 * Export the case identified by the event from DXTR and load the case into CAMS.
 *
 * @param context
 */
function* exportAndLoadCase(context: OrchestrationContext) {
  let event: CaseSyncEvent = context.df.getInput();
  event = yield context.df.callActivity(EXPORT_CASE_ACTIVITY, event);
  event = yield context.df.callActivity(LOAD_CASE_ACTIVITY, event);

  return event;
}

export function setupExportAndLoadCase() {
  df.app.orchestration(EXPORT_AND_LOAD_CASE, exportAndLoadCase);

  df.app.activity(EXPORT_CASE_ACTIVITY, {
    handler: exportCase,
    extraOutputs: [DLQ],
  });

  df.app.activity(LOAD_CASE_ACTIVITY, {
    handler: loadCase,
    extraOutputs: [DLQ],
  });
}
