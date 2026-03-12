import { app, InvocationContext, output } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';

import {
  buildFunctionName,
  buildQueueName,
  buildStartQueueHttpTrigger,
  buildStartQueueTimerTrigger,
  StartMessage,
} from '../dataflows-common';
import SyncTrusteeAppointments from '../../../lib/use-cases/dataflows/sync-trustee-appointments';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { STORAGE_QUEUE_CONNECTION } from '../../../lib/storage-queues';
import { AppInsightsObservability } from '../../../lib/adapters/services/observability';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';

const MODULE_NAME = 'SYNC-TRUSTEE-APPOINTMENTS';
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

const AUTO_MATCHED = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'auto-matched'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const REVIEW_DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'review-dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const FAILURES_DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'failures-dlq'),
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
 * Fetch trustee appointments from DXTR with party data and queue for processing.
 *
 * @param {StartMessage} startMessage
 * @param {InvocationContext} invocationContext
 */
async function handleStart(startMessage: StartMessage, invocationContext: InvocationContext) {
  const logger = ContextCreator.getLogger(invocationContext);
  const observability = new AppInsightsObservability(logger);
  const trace = observability.startTrace(invocationContext.invocationId);
  try {
    const context = await ContextCreator.getApplicationContext({
      invocationContext,
      observability,
    });
    const { events, latestSyncDate } = await SyncTrusteeAppointments.getAppointmentEvents(
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

    if (latestSyncDate) {
      await SyncTrusteeAppointments.storeRuntimeState(context, latestSyncDate);
    }
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
 * Process a page of trustee appointment events by matching to CAMS trustees
 * and updating the SyncedCase with trusteeId.
 *
 * @param {TrusteeAppointmentSyncEvent[]} events
 * @param {InvocationContext} invocationContext
 */
async function handlePage(
  events: TrusteeAppointmentSyncEvent[],
  invocationContext: InvocationContext,
) {
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = appContext.observability.startTrace(invocationContext.invocationId);
  const { successCount, autoMatchedEvents, dlqMessages, scenarioDistribution } =
    await SyncTrusteeAppointments.processAppointments(appContext, events);

  const totalEvents = events.length;
  const autoMatchRate =
    totalEvents > 0 ? (scenarioDistribution.autoMatchCount / totalEvents) * 100 : 0;

  const reviewMessages = dlqMessages.filter(
    (msg) =>
      'mismatchReason' in msg &&
      (msg.mismatchReason === 'IMPERFECT_MATCH' || msg.mismatchReason === 'HIGH_CONFIDENCE_MATCH'),
  );
  const failureMessages = dlqMessages.filter(
    (msg) =>
      'mismatchReason' in msg &&
      (msg.mismatchReason === 'MULTIPLE_TRUSTEES_MATCH' ||
        msg.mismatchReason === 'NO_TRUSTEE_MATCH' ||
        msg.mismatchReason === 'CASE_NOT_FOUND'),
  );
  const errorMessages = dlqMessages.filter((msg) => !('mismatchReason' in msg));

  if (autoMatchedEvents.length) invocationContext.extraOutputs.set(AUTO_MATCHED, autoMatchedEvents);
  if (reviewMessages.length) invocationContext.extraOutputs.set(REVIEW_DLQ, reviewMessages);
  if (failureMessages.length) invocationContext.extraOutputs.set(FAILURES_DLQ, failureMessages);
  if (errorMessages.length) invocationContext.extraOutputs.set(DLQ, errorMessages);

  completeDataflowTrace(
    appContext.observability,
    trace,
    MODULE_NAME,
    'handlePage',
    appContext.logger,
    {
      documentsWritten: successCount,
      documentsFailed: dlqMessages.length,
      success: true,
      details: {
        totalEvents: String(totalEvents),
        autoMatchCount: String(scenarioDistribution.autoMatchCount),
        imperfectMatchCount: String(scenarioDistribution.imperfectMatchCount),
        highConfidenceMatchCount: String(scenarioDistribution.highConfidenceMatchCount),
        noMatchCount: String(scenarioDistribution.noMatchCount),
        multipleMatchCount: String(scenarioDistribution.multipleMatchCount),
        caseNotFoundCount: String(scenarioDistribution.caseNotFoundCount),
        autoMatchedCount: String(autoMatchedEvents.length),
        reviewCount: String(reviewMessages.length),
        failureCount: String(failureMessages.length),
      },
      additionalMetrics: [
        { name: 'TrusteeAutoMatchRate', value: autoMatchRate },
        { name: 'TrusteeTotalEventsProcessed', value: totalEvents },
      ],
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
    extraOutputs: [DLQ, AUTO_MATCHED, REVIEW_DLQ, FAILURES_DLQ],
    handler: handlePage,
  });

  app.timer(TIMER_TRIGGER, {
    schedule: '0 35 9 * * *', // 5 minutes after sync-cases (at 9:30)
    extraOutputs: [START],
    handler: buildStartQueueTimerTrigger(MODULE_NAME, START),
  });

  app.http(HTTP_TRIGGER, {
    route: 'sync-trustee-appointments',
    methods: ['POST'],
    extraOutputs: [START],
    handler: buildStartQueueHttpTrigger(MODULE_NAME, START),
  });
}

export default {
  MODULE_NAME,
  handlePage,
  setup,
  AUTO_MATCHED,
  REVIEW_DLQ,
  FAILURES_DLQ,
  DLQ,
};
