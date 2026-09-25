import { isTooManyRequestsError } from './too-many-requests-error';
import { isGatewayTimeoutError } from './gateway-timeout';

/**
 * Whether an error reflects a transient infrastructure condition (Cosmos RU throttling, a
 * read/write timeout) rather than a genuine outcome about the data being processed. A caller
 * that catches this should retry rather than persist a permanent failure record - nothing about
 * the source record's identity or matchability caused this, and a retry may well succeed.
 */
export function isTransientInfraError(error: unknown): boolean {
  return isTooManyRequestsError(error) || isGatewayTimeoutError(error);
}
