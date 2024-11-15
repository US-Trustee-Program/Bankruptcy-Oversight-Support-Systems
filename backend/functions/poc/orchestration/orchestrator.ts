import { Bounds } from '../model';
import { SUB_ORCHESTRATOR_PAGING } from '../loadConsolidations';
import { OrchestrationContext } from 'durable-functions';

export function* main(context: OrchestrationContext) {
  const bounds: Bounds = context.df.getInput();

  const provisioningTasks = [];

  const { divisionCodes, chapters, dateRange } = bounds;
  // TODO: Add an activity to flatten the arrays
  for (const divisionCode of divisionCodes) {
    for (const chapter of chapters) {
      const predicate = {
        divisionCode,
        chapter,
        dateRange,
      };
      const child_id = context.df.instanceId + `:${divisionCode}:${chapter}:`;
      provisioningTasks.push(
        context.df.callSubOrchestrator(SUB_ORCHESTRATOR_PAGING, predicate, child_id),
      );
    }
  }
  yield context.df.Task.all(provisioningTasks);
}
