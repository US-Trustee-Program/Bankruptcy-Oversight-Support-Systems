import { Auditable } from './auditable';
import { Identifiable } from './document';
import { AbstractTrusteeHistory } from './trustee-history-base';
import {
  VALID,
  ValidatorFunction,
  ValidatorReasonMap,
  ValidatorResult,
  ValidationSpec,
  validateObject,
} from './validation';

function requirePair(
  startField: keyof TrusteeUpcomingReportDatesInput,
  endField: keyof TrusteeUpcomingReportDatesInput,
  startLabel: string,
  endLabel: string,
): ValidatorFunction {
  return (obj: unknown): ValidatorResult => {
    const input = obj as TrusteeUpcomingReportDatesInput;
    const reasonMap: ValidatorReasonMap = {};
    if (input[startField] !== null && input[endField] === null) {
      reasonMap[endField as string] = { reasons: [`${endLabel} is required.`] };
    }
    if (input[endField] !== null && input[startField] === null) {
      reasonMap[startField as string] = { reasons: [`${startLabel} is required.`] };
    }
    return Object.keys(reasonMap).length > 0 ? { reasonMap } : VALID;
  };
}

const trusteeUpcomingReportDatesSpec: ValidationSpec<TrusteeUpcomingReportDatesInput> = {
  $: [
    requirePair(
      'tprReviewPeriodStart',
      'tprReviewPeriodEnd',
      'TPR Review Period Start',
      'TPR Review Period End',
    ),
    requirePair(
      'tirReviewPeriodStart',
      'tirReviewPeriodEnd',
      'TIR Review Period Start',
      'TIR Review Period End',
    ),
  ],
};

export function validateTrusteeUpcomingReportDates(
  input: TrusteeUpcomingReportDatesInput,
): ValidatorResult {
  return validateObject(trusteeUpcomingReportDatesSpec, input);
}

export type TrusteeUpcomingReportDates = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES';
    trusteeId: string;
    appointmentId: string;
    pastFieldExam?: string;
    pastAudit?: string;
    tprReviewPeriodStart?: string;
    tprReviewPeriodEnd?: string;
    tprDue?: string;
    tprDueYearParity?: 'EVEN' | 'ODD';
    tirReviewPeriodStart?: string;
    tirReviewPeriodEnd?: string;
    tirSubmission?: string;
    tirReview?: string;
    upcomingFieldExam?: string;
    upcomingIndependentAuditRequired?: string;
  };

export type TrusteeUpcomingReportDatesInput = {
  trusteeId: string;
  appointmentId: string;
  pastFieldExam: string | null;
  pastAudit: string | null;
  tprReviewPeriodStart: string | null;
  tprReviewPeriodEnd: string | null;
  tprDue: string | null;
  tprDueYearParity: string | null;
  tirReviewPeriodStart: string | null;
  tirReviewPeriodEnd: string | null;
  tirSubmission: string | null;
  tirReview: string | null;
  upcomingFieldExam: string | null;
  upcomingIndependentAuditRequired: string | null;
};

export type TrusteeUpcomingReportDatesHistory = AbstractTrusteeHistory<
  Partial<TrusteeUpcomingReportDates>,
  Partial<TrusteeUpcomingReportDates>
> & {
  documentType: 'AUDIT_UPCOMING_REPORT_DATES';
  appointmentId: string;
};

type DateField =
  | 'pastFieldExam'
  | 'pastAudit'
  | 'tprReviewPeriodStart'
  | 'tprReviewPeriodEnd'
  | 'tprDue'
  | 'tirReviewPeriodStart'
  | 'tirReviewPeriodEnd'
  | 'tirSubmission'
  | 'tirReview'
  | 'upcomingFieldExam'
  | 'upcomingIndependentAuditRequired';

export const DATE_FIELDS: DateField[] = [
  'pastFieldExam',
  'pastAudit',
  'tprReviewPeriodStart',
  'tprReviewPeriodEnd',
  'tprDue',
  'tirReviewPeriodStart',
  'tirReviewPeriodEnd',
  'tirSubmission',
  'tirReview',
  'upcomingFieldExam',
  'upcomingIndependentAuditRequired',
];

type TextField = 'tprDueYearParity';

export const TEXT_FIELDS: TextField[] = ['tprDueYearParity'];

export function isoToMMDDYYYY(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${month}/${day}/${year}`;
}

export function isoToMMYYYY(iso: string): string {
  const [year, month] = iso.split('-');
  return `${month}/${year}`;
}

export function isoToMMDD(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${month}/${day}`;
}

export function isoRangeToMMDD(start: string, end: string): string {
  return `${isoToMMDD(start)} - ${isoToMMDD(end)}`;
}

export function mmddyyyyToISO(str: string): string {
  const [month, day, year] = str.split('/');
  return `${year}-${month}-${day}`;
}

export function mmyyyyToISO(str: string): string {
  const [month, year] = str.split('/');
  return `${year}-${month}-01`;
}

export function mmddToISO(str: string): string {
  const [month, day] = str.split('/');
  return `1900-${month}-${day}`;
}

function isValidISODate(iso: string): boolean {
  const date = new Date(iso);
  return !isNaN(date.getTime()) && date.toISOString().split('T')[0] === iso;
}

export function validateMMDDYYYY(value: unknown): ValidatorResult {
  const error = { reasons: ['Must be a valid date mm/dd/yyyy.'] };
  if (typeof value !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return error;
  }
  const [month, day, year] = value.split('/');
  return isValidISODate(`${year}-${month}-${day}`) ? VALID : error;
}

export function validateMMYYYY(value: unknown): ValidatorResult {
  const error = { reasons: ['Must be a valid date mm/yyyy.'] };
  if (typeof value !== 'string' || !/^\d{2}\/\d{4}$/.test(value)) {
    return error;
  }
  const mm = parseInt(value.split('/')[0], 10);
  if (mm < 1 || mm > 12) return error;
  return VALID;
}

export function validateMMDD(value: unknown): ValidatorResult {
  const error = { reasons: ['Must be a valid date mm/dd.'] };
  if (typeof value !== 'string' || !/^\d{2}\/\d{2}$/.test(value)) {
    return error;
  }
  const [month, day] = value.split('/');
  return isValidISODate(`2000-${month}-${day}`) ? VALID : error;
}

export function validateMMDDRange(value: unknown): ValidatorResult {
  const error = { reasons: ['Must be a valid date mm/dd.'] };
  if (typeof value !== 'string' || !/^\d{2}\/\d{2} - \d{2}\/\d{2}$/.test(value)) {
    return error;
  }
  const [start, end] = value.split(' - ');
  if (!validateMMDD(start).valid || !validateMMDD(end).valid) return error;
  return VALID;
}

function addDaysToSentinel(sentinel: string, days: number): string {
  const [, month, day] = sentinel.split('-').map(Number);
  // Use year 2000 for arithmetic to correctly handle month/day boundaries
  const date = new Date(2000, month - 1, day);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `1900-${mm}-${dd}`;
}

export function calculateTirSubmission(tirReviewPeriodEnd: string): string {
  return addDaysToSentinel(tirReviewPeriodEnd, 30);
}

export function calculateTirReview(tirSubmission: string): string {
  return addDaysToSentinel(tirSubmission, 60);
}

function alignToQuarterEnd(date: Date): Date {
  const quarterEnds = [
    { month: 2, day: 31 }, // March 31 (0-indexed month)
    { month: 5, day: 30 }, // June 30
    { month: 8, day: 30 }, // September 30
    { month: 11, day: 31 }, // December 31
  ];
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  for (const qe of quarterEnds) {
    if (month < qe.month || (month === qe.month && day <= qe.day)) {
      return new Date(year, qe.month, qe.day);
    }
  }
  // Past December 31 — advance to March 31 of next year
  return new Date(year + 1, 2, 31);
}

export function calculateNextAuditDate(
  fieldExam: string | undefined,
  audit: string | undefined,
  yearsToAdd: number,
): string | null {
  const candidates = [fieldExam, audit].filter((d): d is string => !!d);
  if (candidates.length === 0) return null;

  const mostRecent = candidates.reduce((a, b) => (a > b ? a : b));
  const [year, month, day] = mostRecent.split('-').map(Number);
  const date = new Date(year + yearsToAdd, month - 1, day);
  const aligned = alignToQuarterEnd(date);
  const mm = String(aligned.getMonth() + 1).padStart(2, '0');
  return `${aligned.getFullYear()}-${mm}-01`;
}
