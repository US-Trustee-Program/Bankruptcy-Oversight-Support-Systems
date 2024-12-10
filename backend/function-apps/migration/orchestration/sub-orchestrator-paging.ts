import { OrchestrationContext } from 'durable-functions';
import { GET_PAGE_COUNT, SUB_ORCHESTRATOR_ETL } from '../loadConsolidations';
import {
  AcmsPageReport,
  AcmsPredicate,
  AcmsPredicateAndPage,
  AcmsPartitionReport,
} from '../../../lib/use-cases/acms-orders/acms-orders';

export function* subOrchestratorPaging(context: OrchestrationContext) {
  const predicate: AcmsPredicate = context.df.getInput();

  const pageCount: number = yield context.df.callActivity(GET_PAGE_COUNT, predicate);
  const pagingTasks = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const predicateAndPage: AcmsPredicateAndPage = {
      ...predicate,
      pageNumber,
    };
    const child_id = context.df.instanceId + `:${pageNumber}`;
    pagingTasks.push(
      context.df.callSubOrchestrator(SUB_ORCHESTRATOR_ETL, predicateAndPage, child_id),
    );
  }

  yield context.df.Task.all(pagingTasks);

  return pagingTasks.reduce(
    (acc, task) => {
      const report = task.result as AcmsPageReport;
      acc.successful.leadCaseCount += report.successful.leadCaseCount;
      acc.successful.childCaseCount += report.successful.childCaseCount;
      acc.failed.leadCaseIds.push(...report.failed.leadCaseIds);
      acc.failed.leadCaseCount += report.failed.leadCaseCount;
      acc.failed.childCaseCount += report.failed.childCaseCount;
      return acc;
    },
    {
      predicate,
      successful: { leadCaseCount: 0, childCaseCount: 0 },
      failed: { leadCaseIds: [], leadCaseCount: 0, childCaseCount: 0 },
    } as AcmsPartitionReport,
  );
}
