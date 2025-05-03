import { CaseSyncEvent } from '../../../../common/src/queue/dataflow-types';
import { CamsError } from '../../common-errors/cams-error';

export type MaybeCaseSyncEvents = MaybeError & {
  events?: CaseSyncEvent[];
};

export type MaybeData<T = unknown> = MaybeError & {
  data?: T;
};

export type MaybeError<E extends CamsError = CamsError> = {
  error?: E;
};

export type MaybeVoid = MaybeError & {
  success?: true;
};

export type QueueError<E extends CamsError = CamsError> = {
  // NOTE: James says this is gonna bite us when we change the activityName. He is probably right. -- BTP
  activityName: string;
  error: E;
  module: string;
  type: 'QUEUE_ERROR';
};

export function buildQueueError(
  error: CamsError,
  module: string,
  activityName: string,
): QueueError {
  return {
    activityName,
    error,
    module,
    type: 'QUEUE_ERROR',
  };
}
