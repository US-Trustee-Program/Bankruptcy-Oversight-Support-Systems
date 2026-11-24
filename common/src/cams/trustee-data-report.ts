import { CamsUserReference } from './users';
import { AppointmentChapterType, AppointmentType } from './trustees';

type TrusteeDataReportRunStatus = 'queued' | 'running' | 'completed' | 'failed';

export type TrusteeProfileField =
  'name' | 'companyName' | 'publicAddress' | 'internalAddress' | 'phone' | 'email';

export type TrusteeAppointmentField = 'status' | 'appointedDate' | 'effectiveDate';

/**
 * Counts only. Must never carry trustee names or contact details.
 */
export type TrusteeDataReportSummary = {
  trusteesCompared: number;
  todOnly: number;
  /** Of todOnly, the trustees listed because their TOD status is empty, for review. */
  todOnlyStatusMissing: number;
  camsOnly: number;
  fieldDifferences: number;
  fieldDifferencesByField: Record<TrusteeProfileField, number>;
  appointmentsTodOnly: number;
  appointmentsCamsOnly: number;
  appointmentFieldDifferences: number;
  appointmentFieldDifferencesByField: Record<TrusteeAppointmentField, number>;
  /** Findings, not differences: CAMS appointments covering only some of their district's divisions. */
  appointmentsDivisionsNarrowed: number;
  /** TOD appointments the original load skipped or could not translate, so not compared. */
  todAppointmentsNotTranslated: number;
};

/** Counts added after the first runs were stored. Older runs have no value for them. */
type CountsAddedLater =
  | 'todOnlyStatusMissing' // 2026-11-20
  | 'appointmentsTodOnly' // Slice 2
  | 'appointmentsCamsOnly'
  | 'appointmentFieldDifferences'
  | 'appointmentFieldDifferencesByField'
  | 'appointmentsDivisionsNarrowed'
  | 'todAppointmentsNotTranslated';

/** A summary as stored on a run, which may predate some counts. */
type StoredTrusteeDataReportSummary = Omit<TrusteeDataReportSummary, CountsAddedLater> &
  Partial<Pick<TrusteeDataReportSummary, CountsAddedLater>>;

export type TrusteeDataReportRun = {
  runId: string;
  status: TrusteeDataReportRunStatus;
  startedBy: CamsUserReference;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  failureMessage?: string;
  summary?: StoredTrusteeDataReportSummary;
};

type TrusteeDataDifferenceKind =
  | 'tod-only'
  | 'cams-only'
  | 'field'
  | 'appointment-tod-only'
  | 'appointment-cams-only'
  | 'appointment-field'
  /** A finding, not a difference: the CAMS appointment covers only some of its district's divisions. */
  | 'appointment-divisions-narrowed';

/** Which appointment an appointment row is about. District, chapter and type identify it. */
type TrusteeDataAppointmentIdentity = {
  courtId: string;
  courtName?: string;
  chapter: AppointmentChapterType;
  appointmentType: AppointmentType;
};

export type TrusteeDataDifference = {
  kind: TrusteeDataDifferenceKind;
  camsTrusteeId?: string;
  todIds: string[];
  trusteeName: string;
  field?: TrusteeProfileField | TrusteeAppointmentField;
  /** appointment-* kinds only. */
  appointment?: TrusteeDataAppointmentIdentity;
  camsValue?: string;
  todValue?: string;
  /** tod-only only: listed for review because the trustee's TOD status is empty, not active. */
  todStatusMissing?: boolean;
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
