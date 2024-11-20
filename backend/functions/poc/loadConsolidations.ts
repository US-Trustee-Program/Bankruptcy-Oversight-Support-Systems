import * as df from 'durable-functions';
import { app } from '@azure/functions';

import httpStart from './client/dfClient.function';
import { main } from './orchestration/orchestrator';
import { subOrchestratorETL } from './orchestration/sub-orchestrator-etl';
import { subOrchestratorPaging } from './orchestration/sub-orchestrator-paging';
import getConsolidations from './activity/getConsolidations';
import getPageCount from './activity/getPageCount';
import migrateConsolidation from './activity/migrateConsolidation';
import flattenBoundingArrays from './activity/flattenBoundingArrays';

export const SUB_ORCHESTRATOR_ETL = 'SubOrchestratorETL';
export const SUB_ORCHESTRATOR_PAGING = 'SubOrchestratorPaging';
export const MAIN_ORCHESTRATOR = 'orchestrator';
export const GET_PAGE_COUNT = 'getPageCount';
export const GET_CONSOLIDATIONS = 'getConsolidations';
export const MIGRATE_CONSOLIDATION = 'migrateConsolidation';
export const FLATTEN_BOUNDING_ARRAYS = 'flattenBoundingArrays';

df.app.orchestration(MAIN_ORCHESTRATOR, main);
df.app.orchestration(SUB_ORCHESTRATOR_ETL, subOrchestratorETL);
df.app.orchestration(SUB_ORCHESTRATOR_PAGING, subOrchestratorPaging);
df.app.activity(GET_CONSOLIDATIONS, getConsolidations);
df.app.activity(GET_PAGE_COUNT, getPageCount);
df.app.activity(MIGRATE_CONSOLIDATION, migrateConsolidation);
df.app.activity(FLATTEN_BOUNDING_ARRAYS, flattenBoundingArrays);

app.http('dfClient', {
  route: 'orchestrators/orchestrator',
  extraInputs: [df.input.durableClient()],
  handler: httpStart,
});
