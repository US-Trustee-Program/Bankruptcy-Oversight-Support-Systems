import { app, InvocationContext, output } from '@azure/functions';

import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';
import CasesRuntimeState from '../../../lib/use-cases/dataflows/cases-runtime-state';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import SyncCases from '../../../lib/use-cases/dataflows/sync-cases';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  buildStartQueueTimerTrigger,
  StartMessage,
} from '../dataflows-common';

const MODULE_NAME = 'SYNC-CASES';
const PAGE_SIZE = 100;

// Queues
const START = output.storageQueue({
  connection: 'AzureWebJobsStorage',
  queueName: buildQueueName(MODULE_NAME, 'start'),
});

const PAGE = output.storageQueue({
  connection: 'AzureWebJobsStorage',
  queueName: buildQueueName(MODULE_NAME, 'page'),
});

const DLQ = output.storageQueue({
  connection: 'AzureWebJobsStorage',
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');
const TIMER_TRIGGER = buildFunctionName(MODULE_NAME, 'timerTrigger');

/**
 * handlePage
 *
 * @param page
 * @param invocationContext
 */
async function handlePage(events: CaseSyncEvent[], invocationContext: InvocationContext) {
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const processedEvents = await ExportAndLoadCase.exportAndLoad(appContext, events);

  const failedEvents = processedEvents.filter((event) => !!event.error);
  invocationContext.extraOutputs.set(DLQ, failedEvents);
}

/**
 * handleStart
 *
 * Export and load changed cases from DXTR into CAMS.
 *
 * @param  context
 */
async function handleStart(startMessage: StartMessage, invocationContext: InvocationContext) {
  try {
    const context = await ContextCreator.getApplicationContext({ invocationContext });
    const { events, lastSyncDate } = await SyncCases.getCaseIds(
      context,
      startMessage['lastSyncDate'],
    );

    if (!events.length) {
      return;
    }

    let start = 0;
    let end = 0;

    const pages = [];
    while (end < events.length) {
      start = end;
      end += PAGE_SIZE;
      pages.push(events.slice(start, end));
    }
    invocationContext.extraOutputs.set(PAGE, pages);

    await CasesRuntimeState.storeRuntimeState(context, lastSyncDate);
  } catch (originalError) {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, HANDLE_START),
    );
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: START.connection,
    extraOutputs: [DLQ, PAGE],
    handler: handleStart,
    queueName: START.queueName,
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: PAGE.connection,
    extraOutputs: [DLQ],
    handler: handlePage,
    queueName: PAGE.queueName,
  });

  app.timer(TIMER_TRIGGER, {
    extraOutputs: [START],
    handler: buildStartQueueTimerTrigger(MODULE_NAME, START),
    schedule: '0 30 9 * * *',
  });

  app.http(HTTP_TRIGGER, {
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
    methods: ['POST'],
    route: 'sync-cases',
  });
}

export default {
  MODULE_NAME,
  setup,
};
