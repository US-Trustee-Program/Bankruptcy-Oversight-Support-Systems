import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { app, HttpRequest, HttpResponse, InvocationContext, Timer } from '@azure/functions';

import CamsActivities from './cams-activities';
import DxtrActivities from './dxtr-activities';
import { DxtrCaseChangeEvent, ExportCaseChangeEventsSummary } from './import-dataflow-types';
import { toAzureError } from '../../azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { DLQ } from './import-dataflow-queues';

const MODULE_NAME = 'IMPORT_DATA_FLOW';

const EXPORT_CASE_CHANGE_EVENTS = 'exportCaseChangeEvents';
const EXPORT_AND_LOAD_CASE = 'exportAndLoadCase';
const DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY = 'dxtrExportCaseChangeEventsActivity';
const DXTR_EXPORT_CASE_ACTIVITY = 'dxtrExportCaseActivity';
const CAMS_LOAD_CASE_ACTIVITY = 'camsLoadCaseActivity';

/**
 * exportCaseChangeEvents
 *
 * Export case Ids related to changes in DXTR.
 *
 * @param  context
 */
function* exportCaseChangeEvents(context: OrchestrationContext) {
  const events: DxtrCaseChangeEvent[] = yield context.df.callActivity(
    DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY,
  );

  const defaultSummary: ExportCaseChangeEventsSummary = {
    changedCases: events.length,
    exportedAndLoaded: 0,
    errors: 0,
    noResult: 0,
    completed: 0,
    faulted: 0,
  };

  if (!events.length) {
    return defaultSummary;
  }

  const nextTasks: df.Task[] = [];

  for (const event of events) {
    const child_id = context.df.instanceId + `:${EXPORT_AND_LOAD_CASE}:${event.caseId}:`;
    nextTasks.push(context.df.callSubOrchestrator(EXPORT_AND_LOAD_CASE, event, child_id));
  }

  yield context.df.Task.all(nextTasks);

  const results = nextTasks.reduce((summary, task) => {
    if (task.isCompleted) {
      summary.completed += 1;
    }
    if (task.isFaulted) {
      summary.faulted += 1;
    }
    if (task.result) {
      const event = task.result as unknown as DxtrCaseChangeEvent;
      if (event.error) {
        summary.errors += 1;
      } else {
        summary.exportedAndLoaded += 1;
      }
    } else {
      summary.noResult += 1;
    }

    return summary;
  }, defaultSummary);

  return results;
}

/**
 * exportAndLoadCase
 *
 * Export the case identified by the event from DXTR and load the case into CAMS.
 *
 * @param context
 */
function* exportAndLoadCase(context: OrchestrationContext) {
  let event: DxtrCaseChangeEvent = context.df.getInput();
  event = yield context.df.callActivity(DXTR_EXPORT_CASE_ACTIVITY, event);
  event = yield context.df.callActivity(CAMS_LOAD_CASE_ACTIVITY, event);

  return event;
}

/**
 * importDataflowHttpTrigger
 *
 * @param request
 * @param context
 * @returns
 */
async function importDataflowHttpTrigger(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  try {
    const client = df.getClient(context);

    // TODO: Make sure we have a JWT with SuperAdmin role. Not API key.

    const instanceId: string = await client.startNew(EXPORT_CASE_CHANGE_EVENTS);

    return client.createCheckStatusResponse(request, instanceId);
  } catch (error) {
    return new HttpResponse(toAzureError(ContextCreator.getLogger(context), MODULE_NAME, error));
  }
}

/**
 * importDataflowTimerTrigger
 *
 * @param _myTimer
 * @param context
 */
async function importDataflowTimerTrigger(_myTimer: Timer, context: InvocationContext) {
  const client = df.getClient(context);
  const _instanceId: string = await client.startNew(EXPORT_CASE_CHANGE_EVENTS);
}

/**
 * importDataflowSetup
 */
export function importDataflowSetup() {
  // Register orchestrations
  df.app.orchestration(EXPORT_CASE_CHANGE_EVENTS, exportCaseChangeEvents);
  df.app.orchestration(EXPORT_AND_LOAD_CASE, exportAndLoadCase);

  // Register activities
  df.app.activity(DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY, {
    handler: DxtrActivities.exportCaseChangeEvents,
  });

  df.app.activity(DXTR_EXPORT_CASE_ACTIVITY, {
    handler: DxtrActivities.exportCase,
    extraOutputs: [DLQ],
  });

  df.app.activity(CAMS_LOAD_CASE_ACTIVITY, {
    handler: CamsActivities.loadCase,
    extraOutputs: [DLQ],
  });

  app.timer('exportChangeEventsTimerTrigger', {
    handler: importDataflowTimerTrigger,
    schedule: '0 30 9 * * *',
  });

  // TODO: Add a http endpoint to request the refresh of a specific case??
  app.http('exportChangeEventsHttpTrigger', {
    route: 'changeevent',
    extraInputs: [df.input.durableClient()],
    handler: importDataflowHttpTrigger,
  });
}
