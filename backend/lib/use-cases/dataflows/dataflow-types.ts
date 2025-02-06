import { DxtrCase } from '../../../../common/src/cams/cases';
import { CamsError } from '../../common-errors/cams-error';

export type CaseSyncEvent = {
  type: 'CASE_CHANGED' | 'MIGRATION';
  caseId: string;
  bCase?: DxtrCase;
  error?: unknown;
};

export type ExportCaseChangeEventsSummary = {
  changedCases: number;
  exportedAndLoaded: number;
  errors: number;
  noResult: number;
  completed: number;
  faulted: number;
};

export type CaseSyncResults = {
  events: CaseSyncEvent[];
  lastTxId?: string;
};

/**
 * getDefaultSummary
 */
export function getDefaultSummary(
  override: Partial<ExportCaseChangeEventsSummary> = {},
): ExportCaseChangeEventsSummary {
  return {
    changedCases: 0,
    exportedAndLoaded: 0,
    errors: 0,
    noResult: 0,
    completed: 0,
    faulted: 0,
    ...override,
  };
}

export type MaybeError<E extends CamsError = CamsError> = {
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
  // NOTE: James says this is gonna bite us when we change the activtyName. He is probably right. -- BTP
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
