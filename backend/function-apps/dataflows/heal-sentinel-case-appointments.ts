import { app, InvocationContext, output } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import ModuleNames from './module-names';
import { buildFunctionName, buildQueueName } from './dataflows-common';
import { STORAGE_QUEUE_CONNECTION } from '../../lib/storage-queues';
import { completeDataflowTrace } from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { handleRateLimitRetry } from './dataflows-rate-limit';
import HealSentinelCaseAppointmentsUseCase from '../../lib/use-cases/dataflows/heal-sentinel-case-appointments';
import {
  HealSentinelCaseAppointmentsPageMessage,
  HealSentinelCaseAppointmentsStartMessage,
} from '@common/cams/dataflow-events';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import { ApplicationContext } from '../../lib/adapters/types/basic';

const MODULE_NAME = ModuleNames.HEAL_SENTINEL_CASE_APPOINTMENTS;

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

const HANDLE_START = buildFunctionName(MODULE_NAME, 'handleStart');
const HANDLE_PAGE = buildFunctionName(MODULE_NAME, 'handlePage');

const PAGE_SIZE = 1000;

// host.json functionTimeout is 01:00:00. A page stops 30 seconds short so its requeue lands
// before the host kills the invocation.
const PAGE_BUDGET_MS = 60 * 60 * 1000 - 30 * 1000;

// Spreads escaped pages out so a throttling storm does not wake them all at once.
const MAX_ESCAPE_JITTER_SECONDS = 30;

function requireConnectionString(): string {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }
  return connectionString;
}

/**
 * Handles a 429 that escaped the use case's own retries by requeueing the message with backoff,
 * or routing it to the DLQ once the retry limit is spent. Returns false for any other error.
 */
async function recordRateLimit<TMessage extends { retryCount?: number; firstAttemptAt?: string }>(
  error: unknown,
  message: TMessage,
  queueName: string,
  activityName: string,
  context: ApplicationContext,
  trace: ReturnType<ApplicationContext['observability']['startTrace']>,
  connectionString: string,
): Promise<boolean> {
  const status = await handleRateLimitRetry({
    error,
    message,
    checkQueueName: queueName,
    dlqOutput: DLQ,
    context,
    moduleName: MODULE_NAME,
    activityName,
    connectionString,
  });
  if (status === 'not-rate-limited') return false;
  completeDataflowTrace(context.observability, trace, MODULE_NAME, activityName, context.logger, {
    documentsWritten: 0,
    documentsFailed: status === 'exhausted' ? 1 : 0,
    success: false,
    error: status === 'exhausted' ? 'rate-limit-retry-exhausted' : 'rate-limited-requeued',
  });
  return true;
}

/**
 * Started manually by sending a message to the START queue; there is no timer. Queues one page per
 * linked trustee-professional-ids record (see HealSentinelCaseAppointmentsStartMessage).
 */
async function handleStart(
  message: HealSentinelCaseAppointmentsStartMessage,
  invocationContext: InvocationContext,
): Promise<void> {
  const connectionString = requireConnectionString();
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new HealSentinelCaseAppointmentsUseCase(context);
    const pages = await useCase.startPages(message.ignoreSentinelsHealedOn === true);
    if (pages.length > 0) invocationContext.extraOutputs.set(PAGE, pages);

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
        details: { pagesQueued: String(pages.length) },
      },
    );
  } catch (error) {
    const handled = await recordRateLimit(
      error,
      message as HealSentinelCaseAppointmentsStartMessage & { retryCount?: number },
      START.queueName,
      'handleStart',
      context,
      trace,
      connectionString,
    );
    if (!handled) throw error;
  }
}

/**
 * Heals up to PAGE_SIZE sentinels for one linked record (see
 * HealSentinelCaseAppointmentsUseCase.healPage), then requeues the next page. An escaped page is
 * requeued with its backoff plus jitter as a visibility delay; a finished record is not requeued.
 */
async function handlePage(
  message: HealSentinelCaseAppointmentsPageMessage,
  invocationContext: InvocationContext,
): Promise<void> {
  const connectionString = requireConnectionString();
  const deadline = Date.now() + PAGE_BUDGET_MS;
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  const trace = context.observability.startTrace(invocationContext.invocationId);

  try {
    const useCase = new HealSentinelCaseAppointmentsUseCase(context);
    const result = await useCase.healPage(message, deadline, PAGE_SIZE);

    if (result.next && result.outcome === 'escaped') {
      const jitterSeconds = Math.floor(Math.random() * (MAX_ESCAPE_JITTER_SECONDS + 1));
      await StorageQueueHumbleObject.fromConnectionString(
        connectionString,
        PAGE.queueName,
      ).sendMessage(JSON.stringify(result.next), result.delaySeconds + jitterSeconds);
    } else if (result.next) {
      invocationContext.extraOutputs.set(PAGE, result.next);
    }

    completeDataflowTrace(context.observability, trace, MODULE_NAME, 'handlePage', context.logger, {
      documentsWritten: result.documentsWritten,
      documentsFailed: result.documentsFailed,
      success: true,
      details: { pageSize: String(result.pageSize), outcome: result.outcome },
    });
  } catch (error) {
    const handled = await recordRateLimit(
      error,
      message,
      PAGE.queueName,
      'handlePage',
      context,
      trace,
      connectionString,
    );
    if (!handled) throw error;
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
