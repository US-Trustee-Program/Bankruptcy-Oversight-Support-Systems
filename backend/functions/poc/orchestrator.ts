import { Bounds } from './model';

import * as df from 'durable-functions';

df.app.orchestration('orchestrator', function* (context) {
  const bounds: Bounds = context.df.getInput();

  context.log('orchestrator', JSON.stringify(bounds));

  const provisioningTasks = [];

  const { divisionCodes, chapters, dateRange } = bounds;
  for (const divisionCode of divisionCodes) {
    for (const chapter of chapters) {
      const predicate = {
        divisionCode,
        chapter,
        dateRange,
      };
      const child_id = context.df.instanceId + `:${divisionCode}:${chapter}:`;
      provisioningTasks.push(
        context.df.callSubOrchestrator('subOrchestrator', predicate, child_id),
      );
    }
  }
  yield context.df.Task.all(provisioningTasks);
});
