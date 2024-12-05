import {
  AcmsAggregate,
  AcmsBounds,
  AcmsPartitionReport,
  AcmsPredicate,
} from '../../lib/use-cases/acms-orders/acms-orders';
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

  const summary = provisioningTasks.reduce(
    (acc, task) => {
      const report = task.result as AcmsPartitionReport;
      context.log('Report', JSON.stringify(report));
      acc.successful.leadCaseCount += report.successful.leadCaseCount;
      acc.successful.childCaseCount += report.successful.childCaseCount;
      acc.failed.leadCaseIds.push(...report.failed.leadCaseIds);
      acc.failed.leadCaseCount += report.failed.leadCaseCount;
      acc.failed.childCaseCount += report.failed.childCaseCount;
      return acc;
    },
    {
      successful: { leadCaseCount: 0, childCaseCount: 0 },
      failed: { leadCaseIds: [], leadCaseCount: 0, childCaseCount: 0 },
    } as AcmsAggregate,
  );

  context.log('Summary', JSON.stringify(bounds), JSON.stringify(summary));
}
