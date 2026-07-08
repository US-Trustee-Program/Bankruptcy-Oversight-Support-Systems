import { StorageQueueOutput } from '@azure/functions';
import { isTooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { getCamsError } from '../../lib/common-errors/error-utilities';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import { buildQueueError } from '../../lib/use-cases/dataflows/queue-types';
import type { ApplicationContext } from '../../lib/adapters/types/basic';

export const RATE_LIMIT_RETRY_LIMIT = 10;
export const RATE_LIMIT_BASE_DELAY_SECONDS = 30;
export const RATE_LIMIT_MAX_DELAY_SECONDS = 600;

function computeBackoffSeconds(retryCount: number): number {
  return Math.min(
    Math.pow(2, retryCount) * RATE_LIMIT_BASE_DELAY_SECONDS,
    RATE_LIMIT_MAX_DELAY_SECONDS,
  );
}

export async function handleRateLimitRetry<
  TMessage extends { retryCount?: number; firstAttemptAt?: string },
>(options: {
  error: unknown;
  message: TMessage;
  checkQueueName: string;
  dlqOutput: StorageQueueOutput;
  context: ApplicationContext;
  moduleName: string;
  activityName: string;
  correlationId?: string;
  connectionString: string;
}): Promise<'retried' | 'exhausted' | 'not-rate-limited'> {
  const {
    error,
    message,
    checkQueueName,
    dlqOutput,
    context,
    moduleName,
    activityName,
    correlationId,
    connectionString,
  } = options;

  if (!isTooManyRequestsError(error)) {
    return 'not-rate-limited';
  }

  const { logger } = context;
  const currentRetryCount = message.retryCount ?? 0;

  if (currentRetryCount >= RATE_LIMIT_RETRY_LIMIT) {
    const firstAttemptAt = message.firstAttemptAt;
    const elapsedMs = firstAttemptAt ? Date.now() - new Date(firstAttemptAt).getTime() : 0;
    const elapsedSeconds = Math.ceil(elapsedMs / 1000);

    logger.error(
      moduleName,
      `Rate limit retry limit reached (${RATE_LIMIT_RETRY_LIMIT}). Sending to DLQ. correlationId=${correlationId ?? 'n/a'} elapsedSeconds=${elapsedSeconds}`,
    );

    const queueError = buildQueueError(
      getCamsError(error as Error, moduleName, 'Rate limit retry limit exceeded'),
      moduleName,
      activityName,
    );

    const dlqMessage = { ...queueError, retryCount: currentRetryCount };
    const dlqMessageWithCorrelation = correlationId ? { ...dlqMessage, correlationId } : dlqMessage;

    context.extraOutputs.set(dlqOutput, [dlqMessageWithCorrelation]);

    // Do not rethrow: rethrowing would cause Azure Functions to re-deliver the message
    // and write a duplicate DLQ entry. The message is already in DLQ via
    // context.extraOutputs.set.
    return 'exhausted';
  }

  if (!connectionString) {
    throw new Error('connectionString is required');
  }

  const nextRetryCount = currentRetryCount + 1;
  const visibilityTimeout = computeBackoffSeconds(nextRetryCount);
  const firstAttemptAt = message.firstAttemptAt ?? new Date().toISOString();
  const retryMessage: TMessage = {
    ...message,
    retryCount: nextRetryCount,
    firstAttemptAt,
  } as TMessage;

  // Log only on first retry
  if (nextRetryCount === 1) {
    logger.info(
      moduleName,
      `Entering rate-limit backoff mode. Retrying in ${visibilityTimeout}s (attempt ${nextRetryCount}/${RATE_LIMIT_RETRY_LIMIT}). correlationId=${correlationId ?? 'n/a'} module=${moduleName}`,
    );
  }

  const queueClient = StorageQueueHumbleObject.fromConnectionString(
    connectionString,
    checkQueueName,
  );
  await queueClient.sendMessage(JSON.stringify(retryMessage), visibilityTimeout);

  return 'retried';
}
