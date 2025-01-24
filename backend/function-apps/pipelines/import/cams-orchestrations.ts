import { OrchestrationContext } from 'durable-functions';
import { CAMS_LOAD_CASE_ACTIVITY } from './import-pipeline';
import { DxtrCaseChangeEvent } from './import-pipeline-types';

function* loadCase(context: OrchestrationContext) {
  const event: DxtrCaseChangeEvent = context.df.getInput();
  // TODO: How to DLQ?? Or, how to deal with failures?
  yield context.df.callActivity(CAMS_LOAD_CASE_ACTIVITY, event);
}
const CamsOrchestrations = {
  loadCase,
};

export default CamsOrchestrations;
