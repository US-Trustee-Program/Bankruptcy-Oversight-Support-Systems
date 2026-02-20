import { app, InvocationContext, output } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';

import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  buildStartQueueTimerTrigger,
  StartMessage,
} from '../dataflows-common';
import SyncCases from '../../../lib/use-cases/dataflows/sync-cases';
import CasesRuntimeState from '../../../lib/use-cases/dataflows/cases-runtime-state';
import ExportAndLoadCase from '../../../lib/use-cases/dataflows/export-and-load-case';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { CaseSyncEvent } from '@common/cams/dataflow-events';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { AppInsightsObservability } from '../../../lib/adapters/services/observability';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';

const MODULE_NAME = 'SYNC-CASES';
const PAGE_SIZE = 100;

// Queues
const START = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'start'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

// Registered function names
const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');
const TIMER_TRIGGER = buildFunctionName(MODULE_NAME, 'timerTrigger');

/**
 * handleStart
 *
 * Export and load changed cases from DXTR into CAMS.
 *
 * @param {StartMessage} startMessage
 * @param {InvocationContext} invocationContext
 */
async function handleStart(startMessage: StartMessage, invocationContext: InvocationContext) {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = new AppInsightsObservability();
  const trace = observability.startTrace(invocationContext.invocationId);
  try {
    const context = await ContextCreator.getApplicationContext({
      invocationContext,
      observability,
    });
    const { events, lastCasesSyncDate, lastTransactionsSyncDate } = await SyncCases.getCaseIds(
      context,
      startMessage['lastSyncDate'],
    );

    if (!events.length) {
      completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
      });
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

    await CasesRuntimeState.storeRuntimeState(context, lastCasesSyncDate, lastTransactionsSyncDate);
    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: { pagesQueued: String(pages.length), totalEvents: String(events.length) },
    });
  } catch (originalError) {
    completeDataflowTrace(observability, trace, MODULE_NAME, 'handleStart', logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: originalError instanceof Error ? originalError.message : String(originalError),
    });
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(originalError, MODULE_NAME, HANDLE_START),
    );
  }
}

/**
 * handlePage
 *
 * @param {CaseSyncEvent[]} events
 * @param {InvocationContext} invocationContext
 */
async function handlePage(events: CaseSyncEvent[], invocationContext: InvocationContext) {
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = appContext.observability.startTrace(invocationContext.invocationId);
  const processedEvents = await ExportAndLoadCase.exportAndLoad(appContext, events);

  const failedEvents = processedEvents.filter((event) => !!event.error);
  invocationContext.extraOutputs.set(DLQ, failedEvents);
  const successCount = processedEvents.length - failedEvents.length;
  completeDataflowTrace(
    appContext.observability,
    trace,
    MODULE_NAME,
    'handlePage',
    appContext.logger,
    {
      documentsWritten: successCount,
      documentsFailed: failedEvents.length,
      success: true,
      details: { totalEvents: String(events.length) },
    },
  );
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: START.connection,
    queueName: START.queueName,
    extraOutputs: [DLQ, PAGE],
    handler: handleStart,
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: PAGE.connection,
    queueName: PAGE.queueName,
    extraOutputs: [DLQ],
    handler: handlePage,
  });

  app.timer(TIMER_TRIGGER, {
    schedule: '0 30 9 * * *',
    extraOutputs: [START],
    handler: buildStartQueueTimerTrigger(MODULE_NAME, START),
  });

  app.http(HTTP_TRIGGER, {
    route: 'sync-cases',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export default {
  MODULE_NAME,
  setup,
};
