import { OrchestrationContext } from 'durable-functions';
import { GET_PAGE_COUNT, SUB_ORCHESTRATOR_ETL } from '../loadConsolidations';
import { AcmsPredicate, AcmsPredicateAndPage } from '../../lib/use-cases/acms-orders/acms-orders';

export function* subOrchestratorPaging(context: OrchestrationContext) {
  const predicate: AcmsPredicate = context.df.getInput();

  const pageCount: number = yield context.df.callActivity(GET_PAGE_COUNT, predicate);
  const provisioningTasks = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const predicateAndPage: AcmsPredicateAndPage = {
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
