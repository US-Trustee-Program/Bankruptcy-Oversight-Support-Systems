import {
  AcmsPredicateAndPage,
  AcmsPageReport,
} from '../../../lib/use-cases/acms-orders/acms-orders';
import { GET_CONSOLIDATIONS } from '../loadConsolidations';
import { OrchestrationContext } from 'durable-functions';

export function* subOrchestratorETL(context: OrchestrationContext) {
  const predicateAndPage: AcmsPredicateAndPage = context.df.getInput();

  const leadCaseIds = yield context.df.callActivity(GET_CONSOLIDATIONS, predicateAndPage);

  // TODO: Need to reconsider the report now that we are queuing the ETL tasks. These sane defaults are here to keep the rest of the orchestration from breaking.
  const result: AcmsPageReport = {
    predicateAndPage,
    successful: {
      childCaseCount: 0,
      leadCaseCount: leadCaseIds.length,
    },
    failed: {
      childCaseCount: 0,
      leadCaseCount: 0,
      leadCaseIds: [],
    },
  };
  return result;
}
