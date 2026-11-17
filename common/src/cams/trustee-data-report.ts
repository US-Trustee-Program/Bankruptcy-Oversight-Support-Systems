import { CamsUserReference } from './users';

type TrusteeDataReportRunStatus = 'queued' | 'running' | 'completed' | 'failed';

export type TrusteeProfileField =
  'name' | 'companyName' | 'publicAddress' | 'internalAddress' | 'phone' | 'email';

/**
 * Counts only. Must never carry trustee names or contact details.
 */
export type TrusteeDataReportSummary = {
  trusteesCompared: number;
  todOnly: number;
  camsOnly: number;
  fieldDifferences: number;
  fieldDifferencesByField: Record<TrusteeProfileField, number>;
};

/** @public First consumer is S1.2 (report storage); drop this tag once it imports the type. */
export type TrusteeDataReportRun = {
  runId: string;
  status: TrusteeDataReportRunStatus;
  startedBy: CamsUserReference;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  failureMessage?: string;
  summary?: TrusteeDataReportSummary;
};

// Later slices add appointment-level kinds, a likely cause, and an email outcome.
type TrusteeDataDifferenceKind = 'tod-only' | 'cams-only' | 'field';

export type TrusteeDataDifference = {
  kind: TrusteeDataDifferenceKind;
  camsTrusteeId?: string;
  todIds: string[];
  trusteeName: string;
  field?: TrusteeProfileField;
  camsValue?: string;
  todValue?: string;
};
