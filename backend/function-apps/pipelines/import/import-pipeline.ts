import * as df from 'durable-functions';
import { app } from '@azure/functions';

import DxtrOrchestrations from './dxtr-orchestrations';
import CamsOrchestrations from './cams-orchestrations';
import CamsActivities from './cams-activities';
import importPipelineHttpTrigger from './import-pipeline-http-trigger';
import importPipelineTimerTrigger from './import-pipeline-timer-trigger';
import DxtrActivities from './dxtr-activities';

export const DXTR_EXPORT_CASE_CHANGE_EVENTS = 'dxtrExportCaseChangeEvents';
export const DXTR_EXPORT_CASE = 'dxtrExportCase';
export const CAMS_LOAD_CASE = 'camsLoadCase';

export const DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY = 'dxtrExportCaseChangeEventsActivity';
export const DXTR_EXPORT_CASE_ACTIVITY = 'dxtrExportCaseActivity';
export const CAMS_LOAD_CASE_ACTIVITY = 'camsLoadCaseActivity';

export function importPipelineSetup() {
  // Register orchestrations
  df.app.orchestration(DXTR_EXPORT_CASE_CHANGE_EVENTS, DxtrOrchestrations.exportCaseChangeEvents);
  df.app.orchestration(DXTR_EXPORT_CASE, DxtrOrchestrations.exportCase);
  df.app.orchestration(CAMS_LOAD_CASE, CamsOrchestrations.loadCase);

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

  app.timer('dxtrExportChangeEventsTimerTrigger', {
    handler: importPipelineTimerTrigger,
    schedule: '0 30 9 * * *',
  });

  // TODO: Add a http endpoint to request the refresh of a specific case??
  app.http('dxtrExportChangeEventsHttpTrigger', {
    route: 'changeevent',
    extraInputs: [df.input.durableClient()],
    handler: importPipelineHttpTrigger,
  });
}
