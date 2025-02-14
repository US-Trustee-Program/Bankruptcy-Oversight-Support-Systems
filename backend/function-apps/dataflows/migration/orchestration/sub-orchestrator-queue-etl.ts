import { AcmsPredicate } from '../../../../lib/use-cases/dataflows/migrate-consolidations';
import { QUEUE_MIGRATION } from '../migration';
import { OrchestrationContext } from 'durable-functions';

export function* subOrchestratorETL(context: OrchestrationContext) {
  const predicate: AcmsPredicate = context.df.getInput();

  yield context.df.callActivity(QUEUE_MIGRATION, predicate);
}
