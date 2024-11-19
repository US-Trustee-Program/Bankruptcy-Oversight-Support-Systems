import { PredicateAndPage } from '../../lib/use-cases/acms-orders/acms-orders';
import { CONSOLIDATIONS_FROM_ACMS, TRANSFORM_AND_LOAD } from '../loadConsolidations';
import { OrchestrationContext } from 'durable-functions';

export function* subOrchestratorETL(context: OrchestrationContext) {
  const predicateAndPage: PredicateAndPage = context.df.getInput();

  const leadCaseIds = yield context.df.callActivity(CONSOLIDATIONS_FROM_ACMS, predicateAndPage);

  const etlTasks = [];
  for (let i = 0; i < leadCaseIds.length; i++) {
    etlTasks.push(context.df.callActivity(TRANSFORM_AND_LOAD, leadCaseIds[i]));
  }

  yield context.df.Task.all(etlTasks);

  // DO we need to fan in??
  // const sum = parallelTasks.reduce((prev, curr) => prev + curr, 0);
  // yield context.df.callActivity('finalResults??', sum);
}
