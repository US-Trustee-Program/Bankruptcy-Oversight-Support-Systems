import * as df from 'durable-functions';
import { app } from '@azure/functions';

import httpStart from './client/dfClient.function';
import { main } from './orchestration/orchestrator';
import { subOrchestratorETL } from './orchestration/sub-orchestrator-etl';
import { subOrchestratorPaging } from './orchestration/sub-orchestrator-paging';
import getConsolidations from './activity/getConsolidations';
import getPageCount from './activity/getPageCount';
import transformAndLoad from './activity/transformAndLoad';
import flattenBoundingArrays from './activity/flattenBoundingArrays';

export const SUB_ORCHESTRATOR_ETL = 'SubOrchestratorETL';
export const SUB_ORCHESTRATOR_PAGING = 'SubOrchestratorPaging';
export const MAIN_ORCHESTRATOR = 'orchestrator';
export const PAGE_COUNT_ACTIVITY = 'getPageCountFromACMS';
export const CONSOLIDATIONS_FROM_ACMS = 'getConsolidationsFromACMS';
export const TRANSFORM_AND_LOAD = 'transformAndLoad';
export const FLATTEN_BOUNDING_ARRAYS = 'flattenBoundingArrays';

df.app.orchestration(MAIN_ORCHESTRATOR, main);
df.app.orchestration(SUB_ORCHESTRATOR_ETL, subOrchestratorETL);
df.app.orchestration(SUB_ORCHESTRATOR_PAGING, subOrchestratorPaging);
df.app.activity(CONSOLIDATIONS_FROM_ACMS, getConsolidations);
df.app.activity(PAGE_COUNT_ACTIVITY, getPageCount);
df.app.activity(TRANSFORM_AND_LOAD, transformAndLoad);
df.app.activity(FLATTEN_BOUNDING_ARRAYS, flattenBoundingArrays);

app.http('dfClient', {
  route: 'orchestrators/orchestrator',
  extraInputs: [df.input.durableClient()],
  handler: httpStart,
});
