import * as df from 'durable-functions';
import { app } from '@azure/functions';

import httpStart from './migrate-consolidations/client/acms-migration-trigger.function';
import { main } from './migrate-consolidations/orchestration/orchestrator';
import { subOrchestratorETL } from './migrate-consolidations/orchestration/sub-orchestrator-queue-etl';
import queueMigrateConsolidation from './migrate-consolidations/activity/queueMigrateConsolidation';
import migrateConsolidation from './migrate-consolidations/queueTrigger/migrateConsolidation';
import flattenBoundingArrays from './migrate-consolidations/activity/flattenBoundingArrays';
import {
  failQueue,
  FLATTEN_BOUNDING_ARRAYS_ACTIVITY,
  HTTP_TRIGGER,
  MAIN_ORCHESTRATOR,
  MIGRATE_CONSOLIDATION,
  migrationQueue,
  QUEUE_MIGRATION_ACTIVITY,
  SUB_ORCHESTRATOR_ETL,
  successQueue,
} from './migrate-consolidations/migrate-consolidations-constants';

export function setupMigrateConsolidations() {
  df.app.orchestration(MAIN_ORCHESTRATOR, main);
  df.app.orchestration(SUB_ORCHESTRATOR_ETL, subOrchestratorETL);

  df.app.activity(QUEUE_MIGRATION_ACTIVITY, {
    extraOutputs: [migrationQueue],
    handler: queueMigrateConsolidation,
  });
  df.app.activity(FLATTEN_BOUNDING_ARRAYS_ACTIVITY, flattenBoundingArrays);

  app.storageQueue(MIGRATE_CONSOLIDATION, {
    connection: 'AzureWebJobsStorage',
    queueName: migrationQueue.queueName,
    extraOutputs: [successQueue, failQueue],
    handler: migrateConsolidation,
  });

  app.http(HTTP_TRIGGER, {
    route: 'migrateconsolidations',
    methods: ['POST'],
    extraInputs: [df.input.durableClient()],
    handler: httpStart,
  });
}
