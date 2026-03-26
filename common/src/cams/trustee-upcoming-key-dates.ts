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

// ============================================================================
// Granular validation functions - Single source of truth for all validation
// Used by both frontend components and top-level form validation
// ============================================================================

/**
 * Validates a single month/day field (sentinel date format: 1900-MM-DD)
 * Returns error if date is incomplete or invalid
 * @param value - ISO date string in format "1900-MM-DD" or null/empty
 * @returns ValidatorResult with error message if invalid
 */
export function validateMonthDay(value: string | null | undefined): ValidatorResult {
  if (!value || value === '') return VALID;

  // Check if it's a valid ISO date
  if (!isValidISODate(value)) {
    return { reasons: ['Must be a valid date mm/dd.'] };
  }

  return VALID;
}

/**
 * Validates a month/day range (start and end must both be present or both absent)
 * Priority: incomplete date error > pair validation error
 * @returns Single error message (not per-field) to display on the range component
 */
export function validateMonthDayRange(
  start: string | null | undefined,
  end: string | null | undefined,
): ValidatorResult {
  // Check for incomplete dates first (higher priority)
  const startResult = validateMonthDay(start);
  if (!startResult.valid) return startResult;

  const endResult = validateMonthDay(end);
  if (!endResult.valid) return endResult;

  // Check pair requirement (both or neither)
  const hasStart = !!start;
  const hasEnd = !!end;

  if (hasStart && !hasEnd) {
    return { reasons: ['End date is required.'] };
  }
  if (hasEnd && !hasStart) {
    return { reasons: ['Start date is required.'] };
  }

  return VALID;
}

/**
 * Validates a full date field (YYYY-MM-DD format)
 * @param value - ISO date string or null/empty
 * @returns ValidatorResult with error message if invalid
 */
function validateFullDate(value: string | null | undefined): ValidatorResult {
  if (!value || value === '') return VALID;

  if (!isValidISODate(value)) {
    return { reasons: ['Must be a valid date mm/dd/yyyy.'] };
  }

  return VALID;
}

// ============================================================================
// Internal validation functions for top-level form validation
// ============================================================================

function requirePair(
  startField: keyof TrusteeUpcomingKeyDatesInput,
  endField: keyof TrusteeUpcomingKeyDatesInput,
  startLabel: string,
  endLabel: string,
): ValidatorFunction {
  return (obj: unknown): ValidatorResult => {
    const input = obj as TrusteeUpcomingKeyDatesInput;
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

function validateDateFields(): ValidatorFunction {
  return (obj: unknown): ValidatorResult => {
    const input = obj as TrusteeUpcomingKeyDatesInput;
    const reasonMap: ValidatorReasonMap = {};

    // Validate sentinel date fields (MM/DD format)
    const sentinelFields: DateField[] = [
      'tprReviewPeriodStart',
      'tprReviewPeriodEnd',
      'tprDue',
      'tirReviewPeriodStart',
      'tirReviewPeriodEnd',
      'tirSubmission',
      'tirReview',
    ];

    sentinelFields.forEach((field) => {
      const result = validateMonthDay(input[field]);
      if (!result.valid) {
        reasonMap[field] = result;
      }
    });

    // Validate full date fields (MM/DD/YYYY format)
    const fullDateFields: DateField[] = [
      'pastFieldExam',
      'pastAudit',
      'upcomingFieldExam',
      'upcomingIndependentAuditRequired',
    ];

    fullDateFields.forEach((field) => {
      const result = validateFullDate(input[field]);
      if (!result.valid) {
        reasonMap[field] = result;
      }
    });

    return Object.keys(reasonMap).length > 0 ? { reasonMap } : VALID;
  };
}

const trusteeUpcomingKeyDatesSpec: ValidationSpec<TrusteeUpcomingKeyDatesInput> = {
  $: [
    validateDateFields(),
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
    requirePair('tprDue', 'tprDueYearType', 'TPR Due', 'TPR Due Year Type'),
  ],
};

export function validateTrusteeUpcomingKeyDates(
  input: TrusteeUpcomingKeyDatesInput,
): ValidatorResult {
  return validateObject(trusteeUpcomingKeyDatesSpec, input);
}

/**
 * Validates the tprDue / tprDueYearType pair for blur-time feedback.
 * Returns the first applicable error message, or '' if valid.
 */
export function validateTprDuePair(
  tprDue: string | null | undefined,
  tprDueYearType: string | null | undefined,
): string {
  if (!tprDue && !tprDueYearType) return '';
  // Priority 1: incomplete date
  const dateResult = validateMonthDay(tprDue);
  if (!dateResult.valid) return dateResult.reasons?.[0] ?? '';
  // Priority 2: complete date but no year type
  if (tprDue && !tprDueYearType) return 'TPR Due Year Type is required.';
  // Priority 3: year type set but no date
  if (!tprDue && tprDueYearType) return validateMonthDay('1900--').reasons?.[0] ?? '';
  return '';
}

export type TrusteeUpcomingKeyDates = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES';
    trusteeId: string;
    appointmentId: string;
    pastFieldExam?: string;
    pastAudit?: string;
    tprReviewPeriodStart?: string;
    tprReviewPeriodEnd?: string;
    tprDue?: string;
    tprDueYearType?: 'EVEN' | 'ODD';
    tirReviewPeriodStart?: string;
    tirReviewPeriodEnd?: string;
    tirSubmission?: string;
    tirReview?: string;
    upcomingFieldExam?: string;
    upcomingIndependentAuditRequired?: string;
  };

export type TrusteeUpcomingKeyDatesInput = {
  trusteeId: string;
  appointmentId: string;
  pastFieldExam: string | null;
  pastAudit: string | null;
  tprReviewPeriodStart: string | null;
  tprReviewPeriodEnd: string | null;
  tprDue: string | null;
  tprDueYearType: string | null;
  tirReviewPeriodStart: string | null;
  tirReviewPeriodEnd: string | null;
  tirSubmission: string | null;
  tirReview: string | null;
  upcomingFieldExam: string | null;
  upcomingIndependentAuditRequired: string | null;
};

export type TrusteeUpcomingKeyDatesHistory = AbstractTrusteeHistory<
  Partial<TrusteeUpcomingKeyDates>,
  Partial<TrusteeUpcomingKeyDates>
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

type TextField = 'tprDueYearType';

export const TEXT_FIELDS: TextField[] = ['tprDueYearType'];

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

export function isoToSentinel(isoDate: string): string {
  if (!isoDate) {
    return '';
  }
  const parts = isoDate.split('-');
  if (parts.length !== 3) {
    return '';
  }
  const [, month, day] = parts;
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

const SENTINEL_YEAR = 1900;
const ARITHMETIC_YEAR = 2000; // 1900 was not a leap year; use 2000 for correct day arithmetic

function addDaysToSentinel(sentinel: string, days: number): string {
  const [, month, day] = sentinel.split('-').map(Number);
  const date = new Date(ARITHMETIC_YEAR, month - 1, day);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${SENTINEL_YEAR}-${mm}-${dd}`;
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

function mostRecentIso(dates: (string | undefined)[]): string | null {
  const candidates = dates.filter((d): d is string => !!d);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a > b ? a : b));
}

function addYears(iso: string, years: number): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year + years, month - 1, day);
}

function startOfMonthIso(date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

export function calculateNextAuditDate(
  fieldExam: string | undefined,
  audit: string | undefined,
  yearsToAdd: number,
): string | null {
  const mostRecent = mostRecentIso([fieldExam, audit]);
  if (!mostRecent) return null;

  const dateWithOffset = addYears(mostRecent, yearsToAdd);
  const aligned = alignToQuarterEnd(dateWithOffset);
  return startOfMonthIso(aligned);
}
