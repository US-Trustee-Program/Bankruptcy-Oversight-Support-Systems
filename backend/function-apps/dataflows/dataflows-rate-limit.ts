import { StorageQueueOutput } from '@azure/functions';
import { isTooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../lib/common-errors/gateway-timeout';
import { getCamsError } from '../../lib/common-errors/error-utilities';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import { buildQueueError } from '../../lib/use-cases/dataflows/queue-types';
import type { ApplicationContext } from '../../lib/adapters/types/basic';

export const RATE_LIMIT_RETRY_LIMIT = 10;
export const RATE_LIMIT_BASE_DELAY_SECONDS = 30;
export const RATE_LIMIT_MAX_DELAY_SECONDS = 600;

export function computeBackoffSeconds(retryCount: number): number {
  return Math.min(
    Math.pow(2, retryCount) * RATE_LIMIT_BASE_DELAY_SECONDS,
    RATE_LIMIT_MAX_DELAY_SECONDS,
  );
}

/**
 * Applies +/-10% jitter around computeBackoffSeconds' deterministic curve so that many
 * dataflows retrying concurrently (e.g. during a system-wide Cosmos RU exhaustion event) don't
 * all land on identical visibility-timeout boundaries. Jitter is centered on the base value
 * (0.9x..1.1x) rather than added on top of it (1.0x..1.2x): additive jitter would push the
 * capped tail of the curve (retries 5-10, all at RATE_LIMIT_MAX_DELAY_SECONDS) up to 720s,
 * above the hard Azure Storage Queue visibility-timeout ceiling of 600s. Centering keeps the
 * expected value equal to the un-jittered base, so the retry budget is unchanged, while the
 * capped retries still get a real [540, 600) spread instead of clamping to one fixed point.
 */
export function computeBackoffSecondsWithJitter(retryCount: number): number {
  const base = computeBackoffSeconds(retryCount);
  const jittered = base * 0.9 + Math.random() * base * 0.2;
  return Math.max(1, Math.min(Math.round(jittered), RATE_LIMIT_MAX_DELAY_SECONDS));
}

/**
 * Handles a transient infrastructure error (Cosmos RU throttling or a gateway timeout) for a
 * queue-driven dataflow activity by requeuing the message with an exponential, jittered backoff
 * delay, up to RATE_LIMIT_RETRY_LIMIT attempts, after which it is routed to the DLQ. Both
 * isTooManyRequestsError and isGatewayTimeoutError are treated as the same signal — RU throttling
 * surfaces as either a 429 or, when Cosmos aborts a query mid-execution, a gateway timeout, and
 * both are produced by the same Mongo adapter error-translation path (matching the pairing used
 * in sync-trustee-case-appointments.ts's per-event transient-error check). Returns
 * 'not-rate-limited' for any other error, leaving it to the caller.
 */
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
  /**
   * Payload recorded on the DLQ entry in place of `message` when retries are exhausted. Callers
   * whose message carries sensitive data pass a redacted projection here; retry bookkeeping still
   * comes from `message`.
   */
  dlqMessage?: unknown;
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
    dlqMessage: dlqPayload,
  } = options;

  if (!isTooManyRequestsError(error) && !isGatewayTimeoutError(error)) {
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
      `Transient-error retry limit reached (${RATE_LIMIT_RETRY_LIMIT}). Sending to DLQ. correlationId=${correlationId ?? 'n/a'} elapsedSeconds=${elapsedSeconds}`,
    );

    const queueError = buildQueueError(
      getCamsError(error as Error, moduleName, 'Transient-error retry limit exceeded'),
      moduleName,
      activityName,
    );

    const dlqMessage = {
      ...queueError,
      retryCount: currentRetryCount,
      message: dlqPayload ?? message,
    };
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
  const visibilityTimeout = computeBackoffSecondsWithJitter(nextRetryCount);
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
      `Entering transient-error backoff mode. Retrying in ${visibilityTimeout}s (attempt ${nextRetryCount}/${RATE_LIMIT_RETRY_LIMIT}). correlationId=${correlationId ?? 'n/a'} module=${moduleName}`,
    );
  }

  const queueClient = StorageQueueHumbleObject.fromConnectionString(
    connectionString,
    checkQueueName,
  );
  await queueClient.sendMessage(JSON.stringify(retryMessage), visibilityTimeout);

  return 'retried';
}

/**
 * Requeues a single-event retry message with an exponential, jittered backoff delay instead of
 * an immediate requeue. The migration handlers that still track their own retryCount/RETRY_LIMIT
 * bookkeeping (see handleRetry in migrate-cases.ts and the three resync-*.ts migrations) looped
 * their DLQ->handleError->RETRY->handleRetry cycle with no delay between attempts: Azure
 * redelivers a requeued storage-queue message almost immediately, so all 3 attempts could burn
 * through in seconds under sustained throttling. This reuses the event's own retryCount (already
 * tracked for the retry-limit check) as the backoff exponent, rather than introducing a second
 * counter that could collide with it.
 */
export async function requeueSingleEventWithBackoff<TMessage extends { retryCount?: number }>(
  message: TMessage,
  queueName: string,
  connectionString: string,
): Promise<void> {
  const nextRetryCount = (message.retryCount ?? 0) + 1;
  const visibilityTimeout = computeBackoffSecondsWithJitter(nextRetryCount);

  const queueClient = StorageQueueHumbleObject.fromConnectionString(connectionString, queueName);
  await queueClient.sendMessage(JSON.stringify(message), visibilityTimeout);
}
