import * as dotenv from 'dotenv';
import * as df from 'durable-functions';
import { app, output } from '@azure/functions';

import httpStart from './client/acms-migration-trigger.function';
import { main } from './orchestration/orchestrator';
import { subOrchestratorETL } from './orchestration/sub-orchestrator-queue-etl';
import { subOrchestratorPaging } from './orchestration/sub-orchestrator-paging';
import getConsolidations from './activity/getConsolidations';
import getPageCount from './activity/getPageCount';
import migrateConsolidation from './queueTrigger/migrateConsolidation';
import flattenBoundingArrays from './activity/flattenBoundingArrays';

export const SUB_ORCHESTRATOR_ETL = 'SubOrchestratorETL';
export const SUB_ORCHESTRATOR_PAGING = 'SubOrchestratorPaging';
export const MAIN_ORCHESTRATOR = 'orchestrator';
export const GET_PAGE_COUNT = 'getPageCount';
export const GET_CONSOLIDATIONS = 'getConsolidations';
export const MIGRATE_CONSOLIDATION = 'migrateConsolidation';
export const FLATTEN_BOUNDING_ARRAYS = 'flattenBoundingArrays';

dotenv.config();

df.app.orchestration(MAIN_ORCHESTRATOR, main);
df.app.orchestration(SUB_ORCHESTRATOR_ETL, subOrchestratorETL);
df.app.orchestration(SUB_ORCHESTRATOR_PAGING, subOrchestratorPaging);
df.app.activity(GET_CONSOLIDATIONS, getConsolidations);
df.app.activity(GET_PAGE_COUNT, getPageCount);
df.app.activity(FLATTEN_BOUNDING_ARRAYS, flattenBoundingArrays);

const successQueue = output.storageQueue({
  queueName: process.env.CAMS_MIGRATION_TASK_SUCCESS_QUEUE,
  connection: 'AzureWebJobs',
});

const failQueue = output.storageQueue({
  queueName: process.env.CAMS_MIGRATION_TASK_FAIL_QUEUE,
  connection: 'AzureWebJobs',
});

app.storageQueue(MIGRATE_CONSOLIDATION, {
  queueName: process.env.CAMS_MIGRATION_TASK_QUEUE,
  connection: 'AzureWebJobs',
  handler: migrateConsolidation,
  extraOutputs: [successQueue, failQueue],
});

app.http('dfClient', {
  route: 'migrations/consolidation',
  extraInputs: [df.input.durableClient()],
  handler: httpStart,
});
