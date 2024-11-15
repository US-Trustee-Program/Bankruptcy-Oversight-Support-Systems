import { CONSOLIDATIONS_FROM_ACMS, TRANSFORM_AND_LOAD } from '../loadConsolidations';
import { PredicateAndPage } from '../model';
import { OrchestrationContext } from 'durable-functions';

export function* subOrchestratorETL(context: OrchestrationContext) {
  const predicateAndPage: PredicateAndPage = context.df.getInput();

  const consolidatedOrdersPage = yield context.df.callActivity(
    CONSOLIDATIONS_FROM_ACMS,
    predicateAndPage,
  );

  const parallelTasks = [];
  for (let i = 0; i < consolidatedOrdersPage.length; i++) {
    parallelTasks.push(context.df.callActivity(TRANSFORM_AND_LOAD, consolidatedOrdersPage[i]));
  }

  yield context.df.Task.all(parallelTasks);

  // DO we need to fan in??
  // const sum = parallelTasks.reduce((prev, curr) => prev + curr, 0);
  // yield context.df.callActivity('finalResults??', sum);
}
