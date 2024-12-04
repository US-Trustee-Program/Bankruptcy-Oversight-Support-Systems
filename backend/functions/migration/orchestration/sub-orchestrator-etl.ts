import {
  AcmsConsolidationReport,
  AcmsPredicateAndPage,
} from '../../lib/use-cases/acms-orders/acms-orders';
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

  const finalResults = etlTasks.reduce(
    (acc, task) => {
      const taskResponse = task as AcmsConsolidationReport;
      if (taskResponse.success) {
        acc.successful += 1;
      } else {
        acc.failed += 1;
      }
      return acc;
    },
    { successful: 0, failed: 0 },
  );
  context.log(
    `ACMS Consolidation Migration ETL: successful: ${finalResults.successful}, failures: ${finalResults.failed}`,
  );
}
