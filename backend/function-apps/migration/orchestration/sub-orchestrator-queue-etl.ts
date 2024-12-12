import { output } from '@azure/functions';
import {
  AcmsPredicateAndPage,
  AcmsPageReport,
  AcmsEtlQueueItem,
} from '../../../lib/use-cases/acms-orders/acms-orders';
import { GET_CONSOLIDATIONS } from '../loadConsolidations';
import { OrchestrationContext } from 'durable-functions';

export const etlQueueOutput = output.storageQueue({
  queueName: 'outqueue',
  connection: 'MyStorageConnectionAppSetting',
});

export function* subOrchestratorETL(context: OrchestrationContext) {
  const predicateAndPage: AcmsPredicateAndPage = context.df.getInput();

  const leadCaseIds = yield context.df.callActivity(GET_CONSOLIDATIONS, predicateAndPage);

  const queueItems = [];
  for (let i = 0; i < leadCaseIds.length; i++) {
    const leadCaseIdString = leadCaseIds[i].toString();
    const queueItem: AcmsEtlQueueItem = {
      divisionCode: predicateAndPage.divisionCode,
      chapter: predicateAndPage.chapter,
      leadCaseId: leadCaseIdString,
    };
    queueItems.push(queueItem);
  }
  context.extraOutputs.set(etlQueueOutput, queueItems);

  // TODO: Need to reconsider the report now that we are queuing the ETL tasks. These sane defaults are here to keep the rest of the orchestration from breaking.
  const result: AcmsPageReport = {
    predicateAndPage,
    successful: {
      childCaseCount: 0,
      leadCaseCount: queueItems.length,
    },
    failed: {
      childCaseCount: 0,
      leadCaseCount: 0,
      leadCaseIds: [],
    },
  };
  return result;
}
