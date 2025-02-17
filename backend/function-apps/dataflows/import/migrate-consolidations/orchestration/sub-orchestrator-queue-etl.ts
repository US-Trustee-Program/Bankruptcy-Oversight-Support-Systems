import { OrchestrationContext } from 'durable-functions';
import { AcmsPredicate } from '../../../../../lib/use-cases/dataflows/migrate-consolidations';
import { QUEUE_MIGRATION_ACTIVITY } from '../migrate-consolidations-constants';

export function* subOrchestratorETL(context: OrchestrationContext) {
  const predicate: AcmsPredicate = context.df.getInput();

  yield context.df.callActivity(QUEUE_MIGRATION_ACTIVITY, predicate);
}
