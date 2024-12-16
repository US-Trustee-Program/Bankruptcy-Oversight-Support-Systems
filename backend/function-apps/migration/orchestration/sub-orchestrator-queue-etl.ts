import { AcmsPredicate } from '../../../lib/use-cases/acms-orders/acms-orders';
import { QUEUE_MIGRATION } from '../loadConsolidations';
import { OrchestrationContext } from 'durable-functions';

export function* subOrchestratorETL(context: OrchestrationContext) {
  const predicate: AcmsPredicate = context.df.getInput();

  // TODO: Should we log the lead case IDs that are queued??
  const _leadCaseIds = yield context.df.callActivity(QUEUE_MIGRATION, predicate);
}
