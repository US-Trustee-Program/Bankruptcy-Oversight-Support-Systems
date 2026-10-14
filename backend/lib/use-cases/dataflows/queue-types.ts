import { CamsError } from '../../common-errors/cams-error';
import { CaseSyncEvent } from '@common/cams/dataflow-events';

type MaybeError<E extends CamsError = CamsError> = {
  error?: E;
};

export type MaybeData<T = unknown> = MaybeError & {
  data?: T;
};

export type MaybeVoid = MaybeError & {
  success?: true;
};

export type MaybeCaseSyncEvents = MaybeError & {
  events?: CaseSyncEvent[];
};

export type QueueError<E extends CamsError = CamsError> = {
  type: 'QUEUE_ERROR';
  module: string;
  // NOTE: James says this is gonna bite us when we change the activityName. He is probably right. -- BTP
  activityName: string;
  error: E;
};

export function buildQueueError(
  error: CamsError,
  module: string,
  activityName: string,
): QueueError {
  return {
    type: 'QUEUE_ERROR',
    module,
    activityName,
    error,
  };
}

export const BASE_DELAY_MS = 30_000;
const MAX_BACKOFF_MS = 10 * 60 * 1000;

// Stays under the 01:00:00 functionTimeout in host.json, matching the sibling dataflows.
export const SAFE_THRESHOLD_MS = 56 * 60 * 1000;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function computeNextBackoffMs(attempt: number, baseDelayMs: number): number {
  return Math.min(Math.pow(2, attempt + 1) * baseDelayMs, MAX_BACKOFF_MS);
}

export type BackfillWriteOptions = {
  startedAt: number;
  safeThresholdMs: number;
  baseDelayMs: number;
};
