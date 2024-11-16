import { Predicate, PredicateAndPage } from '../model';
import { OrchestrationContext } from 'durable-functions';
import { PAGE_COUNT_ACTIVITY, SUB_ORCHESTRATOR_ETL } from '../loadConsolidations';

export function* subOrchestratorPaging(context: OrchestrationContext) {
  const predicate: Predicate = context.df.getInput();

  const pageCount: number = yield context.df.callActivity(PAGE_COUNT_ACTIVITY, predicate);
  const provisioningTasks = [];
  for (let pageNumber = 0; pageNumber < pageCount; pageNumber++) {
    const predicateAndPage: PredicateAndPage = {
      ...predicate,
      pageNumber,
    };
    const child_id = context.df.instanceId + `:${pageNumber}`;
    provisioningTasks.push(
      context.df.callSubOrchestrator(SUB_ORCHESTRATOR_ETL, predicateAndPage, child_id),
    );
  }

  yield context.df.Task.all(provisioningTasks);
}
