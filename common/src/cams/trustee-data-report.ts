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

/**
 * GET /api/dev-tools/trustee-data-report: the run in progress, if any, the latest results, and
 * the latest failed run when it failed after those results were produced.
 */
export type TrusteeDataReportStatus = {
  activeRun?: TrusteeDataReportRun;
  latestCompletedRun?: TrusteeDataReportRun;
  latestFailedRun?: TrusteeDataReportRun;
};
