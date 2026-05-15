import { InvocationContext, StorageQueueOutput } from '@azure/functions';
import { isTooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { getCamsError } from '../../lib/common-errors/error-utilities';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import { completeDataflowTrace } from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { buildQueueError } from '../../lib/use-cases/dataflows/queue-types';
import type { ApplicationContext } from '../../lib/adapters/types/basic';

const RATE_LIMIT_RETRY_LIMIT = 10;
const RATE_LIMIT_BASE_DELAY_SECONDS = 30;
const RATE_LIMIT_MAX_DELAY_SECONDS = 600;

function computeBackoffSeconds(retryCount: number): number {
  return Math.min(
    Math.pow(2, retryCount) * RATE_LIMIT_BASE_DELAY_SECONDS,
    RATE_LIMIT_MAX_DELAY_SECONDS,
  );
}

export async function handleRateLimitRetry<TMessage extends { retryCount?: number }>(options: {
  error: unknown;
  message: TMessage;
  checkQueueName: string;
  dlqOutput: StorageQueueOutput;
  invocationContext: InvocationContext;
  context: ApplicationContext;
  moduleName: string;
  activityName: string;
  correlationId?: string;
}): Promise<'retried' | 'exhausted' | 'not-rate-limited'> {
  const {
    error,
    message,
    checkQueueName,
    dlqOutput,
    invocationContext,
    context,
    moduleName,
    activityName,
    correlationId,
  } = options;

  if (!isTooManyRequestsError(error)) {
    return 'not-rate-limited';
  }

  const { logger, observability } = context;
  const trace = observability.startTrace(invocationContext.invocationId);
  const currentRetryCount = message.retryCount ?? 0;

  if (currentRetryCount >= RATE_LIMIT_RETRY_LIMIT) {
    logger.error(
      moduleName,
      `Rate limit retry limit reached (${RATE_LIMIT_RETRY_LIMIT}). Sending to DLQ.`,
    );

    const queueError = buildQueueError(
      getCamsError(error as Error, moduleName, 'Rate limit retry limit exceeded'),
      moduleName,
      activityName,
    );

    const dlqMessage = correlationId ? { ...queueError, correlationId } : queueError;

    invocationContext.extraOutputs.set(dlqOutput, [dlqMessage]);

    completeDataflowTrace(observability, trace, moduleName, activityName, logger, {
      documentsWritten: 0,
      documentsFailed: 1,
      success: false,
      error: 'rate-limit-retry-exhausted',
    });

    return 'exhausted';
  }

  const nextRetryCount = currentRetryCount + 1;
  const visibilityTimeout = computeBackoffSeconds(currentRetryCount);
  const retryMessage: TMessage = {
    ...message,
    retryCount: nextRetryCount,
  };

  logger.warn(
    moduleName,
    `Rate limited (429). Retrying in ${visibilityTimeout}s (attempt ${nextRetryCount}/${RATE_LIMIT_RETRY_LIMIT}).`,
  );

  const connectionString = process.env.AzureWebJobsDataflowsStorage;
  if (!connectionString) {
    throw new Error('Missing required environment variable: AzureWebJobsDataflowsStorage');
  }

  const queueClient = StorageQueueHumbleObject.fromConnectionString(
    connectionString,
    checkQueueName,
  );
  await queueClient.sendMessage(JSON.stringify(retryMessage), visibilityTimeout);

  completeDataflowTrace(observability, trace, moduleName, activityName, logger, {
    documentsWritten: 0,
    documentsFailed: 0,
    success: true,
    details: {
      reason: 'rate-limited-requeued',
      visibilityTimeout: String(visibilityTimeout),
      retryCount: String(nextRetryCount),
    },
  });

  return 'retried';
}
