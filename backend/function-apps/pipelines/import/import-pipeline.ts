import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { app } from '@azure/functions';

import CamsActivities from './cams-activities';
import DxtrActivities from './dxtr-activities';
import importPipelineHttpTrigger from './import-pipeline-http-trigger';
import importPipelineTimerTrigger from './import-pipeline-timer-trigger';
import { DxtrCaseChangeEvent } from './import-pipeline-types';

export const EXPORT_CASE_CHANGE_EVENTS = 'exportCaseChangeEvents';
export const EXPORT_AND_LOAD_CASE = 'exportCaseAndLoadCase';

export const DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY = 'dxtrExportCaseChangeEventsActivity';
export const DXTR_EXPORT_CASE_ACTIVITY = 'dxtrExportCaseActivity';
export const CAMS_LOAD_CASE_ACTIVITY = 'camsLoadCaseActivity';

function* exportCaseChangeEvents(context: OrchestrationContext) {
  const events: DxtrCaseChangeEvent[] = yield context.df.callActivity(
    DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY,
  );

  const nextTasks = [];

  for (const event of events) {
    const child_id = context.df.instanceId + `:${event.type}:${event.caseId}:`;
    nextTasks.push(context.df.callSubOrchestrator(EXPORT_AND_LOAD_CASE, event, child_id));
  }

  yield context.df.Task.all(nextTasks);
}

function* exportAndLoadCase(context: OrchestrationContext) {
  let event: DxtrCaseChangeEvent = context.df.getInput();
  event = yield context.df.callActivity(DXTR_EXPORT_CASE_ACTIVITY, event);
  yield context.df.callActivity(CAMS_LOAD_CASE_ACTIVITY, event);
}

export function importPipelineSetup() {
  // Register orchestrations
  df.app.orchestration(EXPORT_CASE_CHANGE_EVENTS, exportCaseChangeEvents);
  df.app.orchestration(EXPORT_AND_LOAD_CASE, exportAndLoadCase);

  // Register activities
  df.app.activity(DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY, {
    handler: DxtrActivities.exportCaseChangeEvents,
  });

  df.app.activity(DXTR_EXPORT_CASE_ACTIVITY, {
    handler: DxtrActivities.exportCase,
  });

  df.app.activity(CAMS_LOAD_CASE_ACTIVITY, {
    handler: CamsActivities.loadCase,
  });

  app.timer('exportChangeEventsTimerTrigger', {
    handler: importPipelineTimerTrigger,
    schedule: '0 30 9 * * *',
  });

  // TODO: Add a http endpoint to request the refresh of a specific case??
  app.http('exportChangeEventsHttpTrigger', {
    route: 'changeevent',
    extraInputs: [df.input.durableClient()],
    handler: importPipelineHttpTrigger,
  });
}
