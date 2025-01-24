import * as df from 'durable-functions';
import { app, InvocationContext, Timer } from '@azure/functions';

import DxtrOrchestrations from './dxtr-orchestrations';
import CamsOrchestrations from './cams-orchestrations';
import CamsActivities from './cams-activities';

export const DXTR_EXPORT_CASE_CHANGE_EVENTS = 'dxtrExportCaseChangeEvents';
export const DXTR_EXPORT_CASE = 'dxtrExportCase';
export const CAMS_LOAD_CASE = 'camsLoadCase';

export const DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY = 'dxtrExportCaseChangeEventsActivity';
export const DXTR_EXPORT_CASE_ACTIVITY = 'dxtrExportCaseActivity';
export const CAMS_LOAD_CASE_ACTIVITY = 'camsLoadCaseActivity';

async function timer(_myTimer: Timer, context: InvocationContext) {
  const client = df.getClient(context);
  const _instanceId: string = await client.startNew(DXTR_EXPORT_CASE_CHANGE_EVENTS);
}

export function dxtrPipelineSetup() {
  // Register orchestrations
  df.app.orchestration(DXTR_EXPORT_CASE_CHANGE_EVENTS, DxtrOrchestrations.exportCaseChangeEvents);
  df.app.orchestration(DXTR_EXPORT_CASE, DxtrOrchestrations.exportCase);
  df.app.orchestration(CAMS_LOAD_CASE, CamsOrchestrations.loadCase);

  // Register activities
  df.app.activity(DXTR_EXPORT_CASE, {
    handler: DxtrOrchestrations.exportCaseChangeEvents,
  });

  df.app.activity(DXTR_EXPORT_CASE, {
    handler: DxtrOrchestrations.exportCase,
  });

  df.app.activity(CAMS_LOAD_CASE, {
    handler: CamsActivities.loadCase,
  });

  // TODO: Add a http endpoint to request the refresh of a specific case??

  app.timer('dxtrExportChangeEventsTimer', {
    handler: timer,
    schedule: '',
  });
}
