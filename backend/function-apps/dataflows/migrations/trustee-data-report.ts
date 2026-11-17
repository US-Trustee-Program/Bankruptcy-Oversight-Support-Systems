import { app, InvocationContext, output, StorageQueueOutput } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { buildFunctionName, buildQueueName } from '../dataflows-common';
import {
  STORAGE_QUEUE_CONNECTION,
  TRUSTEE_DATA_REPORT_START_QUEUE,
} from '../../../lib/storage-queues';
import { buildQueueError } from '../../../lib/use-cases/dataflows/queue-types';
import { completeDataflowTrace } from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import RunTrusteeDataReport from '../../../lib/use-cases/trustee-data-report/run-trustee-data-report';
import {
  TrusteeDataReportPageMessage,
  TrusteeDataReportStartMessage,
} from '@common/cams/dataflow-events';
import { handleRateLimitRetry } from '../dataflows-rate-limit';
import ModuleNames from '../module-names';

// CAMS-977: compares CAMS trustee profiles with TOD (ATS). Only this function app can reach TOD,
// so the Admin API starts a run by enqueueing a start message. Pages run one after another in
// TOD ID order, and the empty page that ends TOD finalizes the run. The use case holds all logic.

const MODULE_NAME = ModuleNames.TRUSTEE_DATA_REPORT;

const START = TRUSTEE_DATA_REPORT_START_QUEUE;

const PAGE = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'page'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const DLQ = output.storageQueue({
  queueName: buildQueueName(MODULE_NAME, 'dlq'),
  connection: STORAGE_QUEUE_CONNECTION,
});

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');

type ActivityName = 'handleStart' | 'handlePage';

/**
 * Cosmos throttling requeues the same message with backoff. Any other error, or throttling that
 * outlasts its retries, fails the run so the lock is released and the previous results stay.
 */
async function handleFailure(
  error: unknown,
  message: TrusteeDataReportStartMessage | TrusteeDataReportPageMessage,
  queue: StorageQueueOutput,
  activityName: ActivityName,
  context: ApplicationContext,
  invocationContext: InvocationContext,
  trace: ReturnType<ApplicationContext['observability']['startTrace']>,
): Promise<void> {
  const { logger } = context;
  const retryStatus = await handleRateLimitRetry({
    error,
    message,
    checkQueueName: queue.queueName,
    dlqOutput: DLQ,
    context,
    moduleName: MODULE_NAME,
    activityName,
    connectionString: process.env.AzureWebJobsDataflowsStorage ?? '',
  });

  if (retryStatus === 'retried') {
    completeDataflowTrace(context.observability, trace, MODULE_NAME, activityName, logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: false,
      error: 'rate-limited-requeued',
    });
    return;
  }

  // The original message, not getCamsError's generic wrapper, so the run records the real cause.
  const failureMessage = error instanceof Error ? error.message : String(error);
  try {
    await RunTrusteeDataReport.failRun(context, message.runId, failureMessage);
  } catch (failError) {
    logger.error(
      MODULE_NAME,
      `Could not mark run ${message.runId} failed: ${getCamsError(failError as Error, MODULE_NAME).message}`,
    );
  }
  if (retryStatus === 'not-rate-limited') {
    invocationContext.extraOutputs.set(
      DLQ,
      buildQueueError(getCamsError(error as Error, MODULE_NAME), MODULE_NAME, activityName),
    );
  }
  completeDataflowTrace(context.observability, trace, MODULE_NAME, activityName, logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: false,
    error: failureMessage,
  });
}

async function handleStart(
  message: TrusteeDataReportStartMessage,
  invocationContext: InvocationContext,
): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const status = await RunTrusteeDataReport.startRun(context, message.runId);
    if (status === 'started') {
      const firstPage: TrusteeDataReportPageMessage = { runId: message.runId, cursor: null };
      invocationContext.extraOutputs.set(PAGE, firstPage);
    }
    completeDataflowTrace(
      context.observability,
      trace,
      MODULE_NAME,
      'handleStart',
      context.logger,
      {
        documentsWritten: 0,
        documentsFailed: 0,
        success: true,
        details: { runId: message.runId, status },
      },
    );
  } catch (error) {
    await handleFailure(error, message, START, 'handleStart', context, invocationContext, trace);
  }
}

async function handlePage(
  message: TrusteeDataReportPageMessage,
  invocationContext: InvocationContext,
): Promise<void> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const { nextCursor } = await RunTrusteeDataReport.processPage(
      context,
      message.runId,
      message.cursor,
    );
    if (nextCursor !== null) {
      const nextPage: TrusteeDataReportPageMessage = { runId: message.runId, cursor: nextCursor };
      invocationContext.extraOutputs.set(PAGE, nextPage);
    }
    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', context.logger, {
      documentsWritten: 0,
      documentsFailed: 0,
      success: true,
      details: {
        runId: message.runId,
        cursor: String(message.cursor),
        finalized: String(nextCursor === null),
      },
    });
  } catch (error) {
    await handleFailure(error, message, PAGE, 'handlePage', context, invocationContext, trace);
  }
}

function setup() {
  app.storageQueue(HANDLE_START, {
    connection: START.connection,
    queueName: START.queueName,
    extraOutputs: [PAGE, DLQ],
    handler: handleStart,
  });

  app.storageQueue(HANDLE_PAGE, {
    connection: PAGE.connection,
    queueName: PAGE.queueName,
    extraOutputs: [PAGE, DLQ],
    handler: handlePage,
  });
}

export { handleStart, handlePage };
export default {
  MODULE_NAME,
  setup,
};
