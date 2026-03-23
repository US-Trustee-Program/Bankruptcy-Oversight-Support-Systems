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
    fieldExam?: string;
    audit?: string;
    tprReviewPeriodStart?: string;
    tprReviewPeriodEnd?: string;
    tprDue?: string;
    tirReviewPeriodStart?: string;
    tirReviewPeriodEnd?: string;
    tirSubmission?: string;
    tirReview?: string;
  };

export type TrusteeUpcomingReportDatesInput = {
  trusteeId: string;
  appointmentId: string;
  fieldExam: string | null;
  audit: string | null;
  tprReviewPeriodStart: string | null;
  tprReviewPeriodEnd: string | null;
  tprDue: string | null;
  tirReviewPeriodStart: string | null;
  tirReviewPeriodEnd: string | null;
  tirSubmission: string | null;
  tirReview: string | null;
};

export type TrusteeUpcomingReportDatesHistory = AbstractTrusteeHistory<
  Partial<TrusteeUpcomingReportDates>,
  Partial<TrusteeUpcomingReportDates>
> & {
  documentType: 'AUDIT_UPCOMING_REPORT_DATES';
  appointmentId: string;
};

type DateField =
  | 'fieldExam'
  | 'audit'
  | 'tprReviewPeriodStart'
  | 'tprReviewPeriodEnd'
  | 'tprDue'
  | 'tirReviewPeriodStart'
  | 'tirReviewPeriodEnd'
  | 'tirSubmission'
  | 'tirReview';

export const DATE_FIELDS: DateField[] = [
  'fieldExam',
  'audit',
  'tprReviewPeriodStart',
  'tprReviewPeriodEnd',
  'tprDue',
  'tirReviewPeriodStart',
  'tirReviewPeriodEnd',
  'tirSubmission',
  'tirReview',
];

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
