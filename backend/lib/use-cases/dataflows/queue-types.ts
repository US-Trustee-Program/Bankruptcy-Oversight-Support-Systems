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

export function isQueueError(value: unknown): value is QueueError {
  return (value as QueueError | undefined)?.type === 'QUEUE_ERROR';
}

/**
 * Non-sensitive projection of a CaseSyncEvent, safe to write to a DLQ. The bCase payload carries
 * debtor and joint-debtor names and tax IDs, so it is excluded. Fields are picked explicitly so a
 * field added to CaseSyncEvent later stays out of the DLQ until someone opts it in here.
 */
export type CaseSyncEventSummary = Pick<CaseSyncEvent, 'type' | 'caseId'>;

export function toCaseSyncEventSummary(event: CaseSyncEvent): CaseSyncEventSummary {
  return { type: event.type, caseId: event.caseId };
}
