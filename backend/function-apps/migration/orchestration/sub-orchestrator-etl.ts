import {
  AcmsTransformationResult,
  AcmsPredicateAndPage,
  AcmsPageReport,
} from '../../../lib/use-cases/acms-orders/acms-orders';
import { GET_CONSOLIDATIONS, MIGRATE_CONSOLIDATION } from '../loadConsolidations';
import { OrchestrationContext } from 'durable-functions';

export function* subOrchestratorETL(context: OrchestrationContext) {
  const predicateAndPage: AcmsPredicateAndPage = context.df.getInput();

  const leadCaseIds = yield context.df.callActivity(GET_CONSOLIDATIONS, predicateAndPage);

  const etlTasks = [];
  for (let i = 0; i < leadCaseIds.length; i++) {
    const leadCaseIdString = leadCaseIds[i].toString();
    etlTasks.push(context.df.callActivity(MIGRATE_CONSOLIDATION, leadCaseIdString));
  }

  yield context.df.Task.all(etlTasks);

  return etlTasks.reduce(
    (acc, task) => {
      const transformationResult = task.result as AcmsTransformationResult;
      if (transformationResult.success) {
        acc.successful.leadCaseCount += 1;
        acc.successful.childCaseCount += transformationResult.childCaseCount;
      } else {
        acc.failed.leadCaseIds.push(transformationResult.leadCaseId);
        acc.failed.leadCaseCount += 1;
        acc.failed.childCaseCount += transformationResult.childCaseCount;
      }
      return acc;
    },
    {
      predicateAndPage,
      successful: { leadCaseCount: 0, childCaseCount: 0 },
      failed: { leadCaseIds: [], leadCaseCount: 0, childCaseCount: 0 },
    } as AcmsPageReport,
  );
}
