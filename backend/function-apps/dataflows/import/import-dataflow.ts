import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { app, HttpRequest, HttpResponse, InvocationContext, Timer } from '@azure/functions';

import CamsActivities from './cams-activities';
import DxtrActivities from './dxtr-activities';
import { CaseSyncEvent, ExportCaseChangeEventsSummary } from './import-dataflow-types';
import { toAzureError } from '../../azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import AcmsActivities from './acms-activities';
import { DLQ } from './import-dataflow-queues';

const MODULE_NAME = 'IMPORT_DATAFLOW';

// Orchestration Aliases
const ACMS_MIGRATION = 'acmsMigration';
const DXTR_SYNC = 'dxtrSync';
const EXPORT_AND_LOAD_CASE = 'exportAndLoadCase';
const PARTITION_CASEIDS = 'partitionCaseIds';
const SYNC_PARTITION = 'syncPartition';

// Activity Aliases
const ACMS_GET_CASEIDS_TO_MIGRATE_ACTIVITY = 'acmsGetCaseIdsToMigrateActivity';
const DXTR_GET_CASEIDS_TO_SYNC_ACTIVITY = 'dxtrGetCaseIdsToSyncActivity';
const DXTR_EXPORT_CASE_ACTIVITY = 'dxtrExportCaseActivity';
const CAMS_LOAD_CASE_ACTIVITY = 'camsLoadCaseActivity';

/**
 * getDefaultSummary
 */
function getDefaultSummary(
  override: Partial<ExportCaseChangeEventsSummary> = {},
): ExportCaseChangeEventsSummary {
  return {
    changedCases: 0,
    exportedAndLoaded: 0,
    errors: 0,
    noResult: 0,
    completed: 0,
    faulted: 0,
    ...override,
  };
}

/**
 * acmsMigration
 *
 * Get case Ids from ACMS identifying cases to migrate then export and load the cases from DXTR into CAMS.
 *
 * @param  context
 */
function* acmsMigration(context: OrchestrationContext) {
  const events: CaseSyncEvent[] = yield context.df.callActivity(
    ACMS_GET_CASEIDS_TO_MIGRATE_ACTIVITY,
  );

  const child_id = context.df.instanceId + `:${ACMS_MIGRATION}:${PARTITION_CASEIDS}`;
  const summary = yield context.df.callSubOrchestrator(PARTITION_CASEIDS, events, child_id);

  return summary;
}

/**
 * dxtrSync
 *
 * Export and load changed cases from DXTR into CAMS.
 *
 * @param  context
 */
function* dxtrSync(context: OrchestrationContext) {
  const events: CaseSyncEvent[] = yield context.df.callActivity(DXTR_GET_CASEIDS_TO_SYNC_ACTIVITY);

  const child_id = context.df.instanceId + `:${DXTR_SYNC}:${PARTITION_CASEIDS}`;
  const summary = yield context.df.callSubOrchestrator(PARTITION_CASEIDS, events, child_id);

  return summary;
}

/**
 * partitionCaseIds
 *
 * Split the work out into smaller partitions so we're not working with unwieldy array sizes.
 *
 * @param context
 */
function* partitionCaseIds(context: OrchestrationContext) {
  const events: CaseSyncEvent[] = context.df.getInput();

  const nextTasks: df.Task[] = [];

  const count = events.length;
  const partitionCount = Math.ceil(count / 100);
  for (let i = 0; i < partitionCount; i++) {
    const partition = events.slice(i * 100, (i + 1) * 100); // Maybe out of bounds risk...
    const child_id = context.df.instanceId + `:${SYNC_PARTITION}:${i}`;
    nextTasks.push(context.df.callSubOrchestrator(SYNC_PARTITION, partition, child_id));
  }

  yield context.df.Task.all(nextTasks);

  const finalSummary = nextTasks.reduce((acc, task) => {
    if (task.result) {
      const result = task.result as ExportCaseChangeEventsSummary;
      acc.changedCases += result.changedCases;
      acc.exportedAndLoaded += result.exportedAndLoaded;
      acc.completed += result.completed;
      acc.errors += result.errors;
      acc.faulted += result.faulted;
      acc.noResult += result.noResult;
    }
    return acc;
  }, getDefaultSummary());

  return finalSummary;
}

function* syncPartition(context: OrchestrationContext) {
  const events: CaseSyncEvent[] = context.df.getInput();
  const nextTasks: df.Task[] = [];

  for (const event of events) {
    const child_id = context.df.instanceId + `:${EXPORT_AND_LOAD_CASE}:${event.caseId}:`;
    nextTasks.push(context.df.callSubOrchestrator(EXPORT_AND_LOAD_CASE, event, child_id));
  }

  yield context.df.Task.all(nextTasks);

  const results = nextTasks.reduce(
    (summary, task) => {
      if (task.isCompleted) {
        summary.completed += 1;
      }
      if (task.isFaulted) {
        summary.faulted += 1;
      }
      if (task.result) {
        const event = task.result as unknown as CaseSyncEvent;
        if (event.error) {
          summary.errors += 1;
        } else {
          summary.exportedAndLoaded += 1;
        }
      } else {
        summary.noResult += 1;
      }

      return summary;
    },
    getDefaultSummary({ changedCases: events.length }),
  );

  return results;
}

/**
 * exportAndLoadCase
 *
 * Export the case identified by the event from DXTR and load the case into CAMS.
 *
 * @param context
 */
function* exportAndLoadCase(context: OrchestrationContext) {
  let event: CaseSyncEvent = context.df.getInput();
  event = yield context.df.callActivity(DXTR_EXPORT_CASE_ACTIVITY, event);
  event = yield context.df.callActivity(CAMS_LOAD_CASE_ACTIVITY, event);

  return event;
}

/**
 * acmsMigrationHttpTrigger
 *
 * @param request
 * @param context
 * @returns
 */
async function acmsMigrationHttpTrigger(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  try {
    const client = df.getClient(context);
    // const appContext = await DataflowsCommon.getApplicationContext(context);
    // if (!appContext.session?.user?.roles?.includes(CamsRole.SuperUser)) {
    //   throw new ForbiddenError(MODULE_NAME);
    // }

    const instanceId: string = await client.startNew(ACMS_MIGRATION);
    return client.createCheckStatusResponse(request, instanceId);
  } catch (error) {
    return new HttpResponse(toAzureError(ContextCreator.getLogger(context), MODULE_NAME, error));
  }
}

/**
 * dxtrSyncHttpTrigger
 *
 * @param request
 * @param context
 * @returns
 */
async function dxtrSyncHttpTrigger(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  try {
    const client = df.getClient(context);
    // const appContext = await DataflowsCommon.getApplicationContext(context);
    // if (!appContext.session?.user?.roles?.includes(CamsRole.SuperUser)) {
    //   throw new ForbiddenError(MODULE_NAME);
    // }

    const instanceId: string = await client.startNew(DXTR_SYNC);
    return client.createCheckStatusResponse(request, instanceId);
  } catch (error) {
    return new HttpResponse(toAzureError(ContextCreator.getLogger(context), MODULE_NAME, error));
  }
}

/**
 * dxtrSyncTimerTrigger
 *
 * @param _myTimer
 * @param context
 */
async function dxtrSyncTimerTrigger(_myTimer: Timer, context: InvocationContext) {
  const client = df.getClient(context);
  const _instanceId: string = await client.startNew(DXTR_SYNC);
}

/**
 * importDataflowSetup
 */
export function importDataflowSetup() {
  // Register orchestrations
  df.app.orchestration(ACMS_MIGRATION, acmsMigration);
  df.app.orchestration(DXTR_SYNC, dxtrSync);
  df.app.orchestration(EXPORT_AND_LOAD_CASE, exportAndLoadCase);
  df.app.orchestration(PARTITION_CASEIDS, partitionCaseIds);
  df.app.orchestration(SYNC_PARTITION, syncPartition);

  // Register activities
  df.app.activity(ACMS_GET_CASEIDS_TO_MIGRATE_ACTIVITY, {
    handler: AcmsActivities.getCaseIdsToMigrate,
  });

  df.app.activity(DXTR_GET_CASEIDS_TO_SYNC_ACTIVITY, {
    handler: DxtrActivities.getCaseIdsToSync,
  });

  df.app.activity(DXTR_EXPORT_CASE_ACTIVITY, {
    handler: DxtrActivities.exportCase,
    extraOutputs: [DLQ],
  });

  df.app.activity(CAMS_LOAD_CASE_ACTIVITY, {
    handler: CamsActivities.loadCase,
    extraOutputs: [DLQ],
  });

  app.timer('dxtrDyncTimerTrigger', {
    handler: dxtrSyncTimerTrigger,
    schedule: '0 30 9 * * *',
  });

  // TODO: Add a http endpoint to request the refresh of a specific case??
  app.http('dxtrSyncHttpTrigger', {
    route: 'dxtrsync',
    extraInputs: [df.input.durableClient()],
    handler: dxtrSyncHttpTrigger,
  });

  app.http('acmsMigrationHttpTrigger', {
    route: 'acmsmigration',
    extraInputs: [df.input.durableClient()],
    handler: acmsMigrationHttpTrigger,
  });
}
