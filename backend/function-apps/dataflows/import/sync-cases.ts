import * as df from 'durable-functions';
import { OrchestrationContext } from 'durable-functions';
import { app, HttpRequest, HttpResponse, InvocationContext, Timer } from '@azure/functions';

import {
  CaseSyncEvent,
  CaseSyncResults,
  ExportCaseChangeEventsSummary,
  getDefaultSummary,
} from '../../../lib/use-cases/dataflows/dataflow-types';
import { ForbiddenError } from '../../../lib/common-errors/forbidden-error';

import { toAzureError } from '../../azure/functions';
import ContextCreator from '../../azure/application-context-creator';

import { STORE_CASES_RUNTIME_STATE } from './store-cases-runtime-state';
import { EXPORT_AND_LOAD_CASE } from './export-and-load-case';
import { buildUniqueName, isAuthorized } from '../dataflows-common';
import SyncCases from '../../../lib/use-cases/dataflows/sync-cases';

const MODULE_NAME = 'SYNC_CASES_DATAFLOW';

// Orchestration Aliases
const SYNC_CASES = buildUniqueName(MODULE_NAME, 'syncCases');
const PARTITION_CASEIDS = buildUniqueName(MODULE_NAME, 'partitionCaseIds');
const SYNC_PARTITION = buildUniqueName(MODULE_NAME, 'syncPartition');

// Activity Aliases
const GET_CASEIDS_TO_SYNC_ACTIVITY = buildUniqueName(MODULE_NAME, 'getCaseIdsToSyncActivity');

/**
 * getCaseIdsToSync
 *
 * Export caseIds when changes appear in AO_CS, AO_TX, etc.
 *
 * @returns {CaseSyncResults}
 */
async function getCaseIdsToSync(
  _ignore: unknown,
  invocationContext: InvocationContext,
): Promise<CaseSyncResults> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  return SyncCases.getCaseIds(context);
}

/**
 * syncCases
 *
 * Export and load changed cases from DXTR into CAMS.
 *
 * @param  context
 */
function* syncCases(context: OrchestrationContext) {
  const results: CaseSyncResults = yield context.df.callActivity(GET_CASEIDS_TO_SYNC_ACTIVITY);

  const summary = yield context.df.callSubOrchestrator(
    PARTITION_CASEIDS,
    results.events,
    context.df.instanceId + `:${SYNC_CASES}:${PARTITION_CASEIDS}`,
  );

  yield context.df.callSubOrchestrator(
    STORE_CASES_RUNTIME_STATE,
    { lastTxId: results.lastTxId },
    context.df.instanceId + `:${SYNC_CASES}:${STORE_CASES_RUNTIME_STATE}`,
  );

  return summary;
}

/**
 * partitionCaseIds
 *
 * Split the work into smaller partitions so we're not working with unwieldy array sizes.
 *
 * @param context
 */
function* partitionCaseIds(context: OrchestrationContext) {
  const events: CaseSyncEvent[] = context.df.getInput();

  const nextTasks: df.Task[] = [];

  const count = events.length;
  const partitionCount = Math.ceil(count / 100);
  for (let i = 0; i < partitionCount; i++) {
    const partition = events.slice(i * 100, (i + 1) * 100); // May be out of bounds risk...
    const childId = context.df.instanceId + `:${SYNC_PARTITION}:${i}`;
    nextTasks.push(context.df.callSubOrchestrator(SYNC_PARTITION, partition, childId));
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
    const childId = context.df.instanceId + `:${EXPORT_AND_LOAD_CASE}:${event.caseId}:`;
    nextTasks.push(context.df.callSubOrchestrator(EXPORT_AND_LOAD_CASE, event, childId));
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
 * syncCasesHttpTrigger
 *
 * @param request
 * @param context
 * @returns
 */
async function syncCasesHttpTrigger(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  try {
    if (!isAuthorized(request)) {
      throw new ForbiddenError(MODULE_NAME);
    }

    const client = df.getClient(context);
    const instanceId: string = await client.startNew(SYNC_CASES);

    return client.createCheckStatusResponse(request, instanceId);
  } catch (error) {
    return new HttpResponse(toAzureError(ContextCreator.getLogger(context), MODULE_NAME, error));
  }
}

/**
 * syncCasesTimerTrigger
 *
 * @param _myTimer
 * @param context
 */
async function syncCasesTimerTrigger(_myTimer: Timer, context: InvocationContext) {
  const client = df.getClient(context);
  const _instanceId: string = await client.startNew(SYNC_CASES);
}

export function setupSyncCases() {
  df.app.orchestration(SYNC_CASES, syncCases);
  df.app.orchestration(PARTITION_CASEIDS, partitionCaseIds);
  df.app.orchestration(SYNC_PARTITION, syncPartition);

  df.app.activity(GET_CASEIDS_TO_SYNC_ACTIVITY, {
    handler: getCaseIdsToSync,
  });

  app.timer('syncCasesTimerTrigger', {
    handler: syncCasesTimerTrigger,
    schedule: '0 30 9 * * *',
  });

  app.http('syncCasesHttpTrigger', {
    route: 'dxtrsync',
    extraInputs: [df.input.durableClient()],
    handler: syncCasesHttpTrigger,
  });
}
