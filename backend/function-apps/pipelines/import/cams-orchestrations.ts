import { OrchestrationContext } from 'durable-functions';
import { CAMS_LOAD_CASE_ACTIVITY } from './import-pipeline';

function* loadCase(context: OrchestrationContext) {
  // TODO: How to DLQ?? Or, how to deal with failures?
  yield context.df.callActivity(CAMS_LOAD_CASE_ACTIVITY);
}
const CamsOrchestrations = {
  loadCase,
};

export default CamsOrchestrations;
