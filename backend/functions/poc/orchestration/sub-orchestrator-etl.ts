import { PredicateAndPage } from '../../lib/use-cases/acms-orders/acms-orders';
import { GET_CONSOLIDATIONS, MIGRATE_CONSOLIDATION } from '../loadConsolidations';
import { OrchestrationContext } from 'durable-functions';

export function* subOrchestratorETL(context: OrchestrationContext) {
  const predicateAndPage: PredicateAndPage = context.df.getInput();

  const leadCaseIds = yield context.df.callActivity(GET_CONSOLIDATIONS, predicateAndPage);

  const etlTasks = [];
  for (let i = 0; i < leadCaseIds.length; i++) {
    etlTasks.push(context.df.callActivity(MIGRATE_CONSOLIDATION, leadCaseIds[i]));
  }

  yield context.df.Task.all(etlTasks);

  // DO we need to fan in??
  // const sum = parallelTasks.reduce((prev, curr) => prev + curr, 0);
  // yield context.df.callActivity('finalResults??', sum);
}
