import { OrchestrationContext } from 'durable-functions';
import {
  CAMS_LOAD_CASE,
  DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY,
  DXTR_EXPORT_CASE,
  DXTR_EXPORT_CASE_ACTIVITY,
} from './import-pipeline';
import { DxtrCaseChangeEvent } from './import-pipeline-types';

function* exportCaseChangeEvents(context: OrchestrationContext) {
  const events: DxtrCaseChangeEvent[] = yield context.df.callActivity(
    DXTR_EXPORT_CASE_CHANGE_EVENTS_ACTIVITY,
  );

  const nextTasks = [];

  for (const event of events) {
    const child_id = context.df.instanceId + `:${event.type}:${event.caseId}:`;
    nextTasks.push(context.df.callSubOrchestrator(DXTR_EXPORT_CASE, event, child_id));
  }

  yield context.df.Task.all(nextTasks);
}

function* exportCase(context: OrchestrationContext) {
  const event: DxtrCaseChangeEvent = context.df.getInput();
  event.bCase = yield context.df.callActivity(DXTR_EXPORT_CASE_ACTIVITY, event);

  // TODO: come up with a naming scheme for child_id.
  const child_id = context.df.instanceId + `:${event.caseId}:`;
  const nextTask = context.df.callSubOrchestrator(CAMS_LOAD_CASE, event, child_id);

  yield context.df.Task.all([nextTask]);
}

const DxtrOrchestrations = {
  exportCaseChangeEvents,
  exportCase,
};

export default DxtrOrchestrations;
