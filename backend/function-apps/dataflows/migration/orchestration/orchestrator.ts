import {
  AcmsBounds,
  AcmsPredicate,
} from '../../../../lib/use-cases/dataflows/migrate-consolidations';
import { FLATTEN_BOUNDING_ARRAYS, SUB_ORCHESTRATOR_ETL } from '../migration';
import { OrchestrationContext } from 'durable-functions';

export function* main(context: OrchestrationContext) {
  const bounds: AcmsBounds = context.df.getInput();

  const provisioningTasks = [];

  const partitions: AcmsPredicate[] = yield context.df.callActivity(
    FLATTEN_BOUNDING_ARRAYS,
    bounds,
  );
  for (const partition of partitions) {
    const childId = context.df.instanceId + `:${partition.divisionCode}:${partition.chapter}:`;
    provisioningTasks.push(
      context.df.callSubOrchestrator(SUB_ORCHESTRATOR_ETL, partition, childId),
    );
  }
  yield context.df.Task.all(provisioningTasks);
}
