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
