import { output } from '@azure/functions';
import { buildFunctionName, buildQueueName } from '../../dataflows-common';

const MODULE_NAME = 'MIGRATE_CONSOLIDATIONS';

export const migrationQueue = output.storageQueue({
  connection: 'AzureWebJobsStorage',
  queueName: buildQueueName(MODULE_NAME, 'task'),
});

export const successQueue = output.storageQueue({
  connection: 'AzureWebJobsStorage',
  queueName: buildQueueName(MODULE_NAME, 'task', 'success'),
});

export const failQueue = output.storageQueue({
  connection: 'AzureWebJobsStorage',
  queueName: buildQueueName(MODULE_NAME, 'task', 'fail'),
});

// Registered durable function orchestrator names
export const MAIN_ORCHESTRATOR = buildFunctionName(MODULE_NAME, 'main');
export const SUB_ORCHESTRATOR_ETL = buildFunctionName(MODULE_NAME, 'subOrchestratorETL');

// Registered durable function activity names
export const QUEUE_MIGRATION_ACTIVITY = buildFunctionName(MODULE_NAME, 'queueMigrateConsolidation');
export const FLATTEN_BOUNDING_ARRAYS_ACTIVITY = buildFunctionName(
  MODULE_NAME,
  'flattenBoundingArrays',
);

// Registered function names
export const MIGRATE_CONSOLIDATION = buildFunctionName(MODULE_NAME, 'migrateConsolidation');
export const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');
