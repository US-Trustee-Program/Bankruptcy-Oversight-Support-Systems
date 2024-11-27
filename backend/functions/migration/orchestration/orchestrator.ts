import { AcmsBounds, AcmsPredicate } from '../../lib/use-cases/acms-orders/acms-orders';
import { FLATTEN_BOUNDING_ARRAYS, SUB_ORCHESTRATOR_PAGING } from '../loadConsolidations';
import { OrchestrationContext } from 'durable-functions';

export function* main(context: OrchestrationContext) {
  const bounds: AcmsBounds = context.df.getInput();

  const provisioningTasks = [];

  const partitions: AcmsPredicate[] = yield context.df.callActivity(
    FLATTEN_BOUNDING_ARRAYS,
    bounds,
  );
  for (const partition of partitions) {
    const child_id = context.df.instanceId + `:${partition.divisionCode}:${partition.chapter}:`;
    provisioningTasks.push(
      context.df.callSubOrchestrator(SUB_ORCHESTRATOR_PAGING, partition, child_id),
    );
  }
  yield context.df.Task.all(provisioningTasks);
}
