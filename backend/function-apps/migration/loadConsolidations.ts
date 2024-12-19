import * as df from 'durable-functions';
import { app, output } from '@azure/functions';

import httpStart from './client/acms-migration-trigger.function';
import { main } from './orchestration/orchestrator';
import { subOrchestratorETL } from './orchestration/sub-orchestrator-queue-etl';
import queueMigrateConsolidation from './activity/queueMigrateConsolidation';
import migrateConsolidation from './queueTrigger/migrateConsolidation';
import flattenBoundingArrays from './activity/flattenBoundingArrays';

export const SUB_ORCHESTRATOR_ETL = 'SubOrchestratorETL';
export const MAIN_ORCHESTRATOR = 'orchestrator';
export const QUEUE_MIGRATION = 'queueMigrateConsolidation';
export const MIGRATE_CONSOLIDATION = 'migrateConsolidation';
export const FLATTEN_BOUNDING_ARRAYS = 'flattenBoundingArrays';

const migrationQueue = output.storageQueue({
  queueName: 'migration-task',
  connection: 'AzureWebJobs',
});

const successQueue = output.storageQueue({
  queueName: 'migration-task-success',
  connection: 'AzureWebJobs',
});

const failQueue = output.storageQueue({
  queueName: 'migration-task-fail',
  connection: 'AzureWebJobs',
});

df.app.orchestration(MAIN_ORCHESTRATOR, main);
df.app.orchestration(SUB_ORCHESTRATOR_ETL, subOrchestratorETL);
df.app.activity(QUEUE_MIGRATION, {
  handler: queueMigrateConsolidation,
  extraOutputs: [migrationQueue],
});
df.app.activity(FLATTEN_BOUNDING_ARRAYS, flattenBoundingArrays);

app.storageQueue(MIGRATE_CONSOLIDATION, {
  queueName: 'migration-task',
  connection: 'AzureWebJobs',
  handler: migrateConsolidation,
  extraOutputs: [successQueue, failQueue],
});

app.http('dfClient', {
  route: 'migrations/consolidation',
  extraInputs: [df.input.durableClient()],
  handler: httpStart,
});
