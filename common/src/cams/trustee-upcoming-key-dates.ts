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

// Returns true when start and end are both present, non-sentinel, and out of order.
function isPeriodOutOfOrder(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  // Sentinel dates (1900-MM-DD) represent month/day only and may intentionally cross
  // a year boundary (e.g. Apr 1 – Mar 31), so skip chronological check for them.
  if (start.startsWith('1900-') || end.startsWith('1900-')) return false;
  return start > end;
}

function requireChronologicalOrder(
  startField: keyof TrusteeUpcomingKeyDatesInput,
  endField: keyof TrusteeUpcomingKeyDatesInput,
  startLabel: string,
  endLabel: string,
): ValidatorFunction {
  return (obj: unknown): ValidatorResult => {
    const input = obj as TrusteeUpcomingKeyDatesInput;
    const start = input[startField] as string | null;
    const end = input[endField] as string | null;
    if (!isPeriodOutOfOrder(start, end)) return VALID;
    return {
      reasonMap: {
        [startField as string]: { reasons: [`${startLabel} must be before ${endLabel}.`] },
        [endField as string]: { reasons: [`${endLabel} must be after ${startLabel}.`] },
      },
    };
  };
}

const CH13_COMPLETION_STATUS_VALUES = ['Complete', 'Incomplete'] as const;
const CH13_MIN_COMPLETION_YEAR = 1900;
const CH13_MAX_COMPLETION_YEAR = 2100;

function validateCh13CompletionStatus(value: unknown, label: string): ValidatorResult {
  if (value === null || value === undefined) return VALID;
  if (
    !CH13_COMPLETION_STATUS_VALUES.includes(value as (typeof CH13_COMPLETION_STATUS_VALUES)[number])
  ) {
    return { reasons: [`${label} must be one of: ${CH13_COMPLETION_STATUS_VALUES.join(', ')}.`] };
  }
  return VALID;
}

function validateCh13CompletionYear(value: unknown, label: string): ValidatorResult {
  if (value === null || value === undefined) return VALID;
  const isValidYear =
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= CH13_MIN_COMPLETION_YEAR &&
    value <= CH13_MAX_COMPLETION_YEAR;
  if (!isValidYear) {
    return {
      reasons: [
        `${label} must be a whole number between ${CH13_MIN_COMPLETION_YEAR} and ${CH13_MAX_COMPLETION_YEAR}.`,
      ],
    };
  }
  return VALID;
}

function validateCh13CompletionFields(): ValidatorFunction {
  return (obj: unknown): ValidatorResult => {
    const input = obj as TrusteeUpcomingKeyDatesInput;
    const reasonMap: ValidatorReasonMap = {};

    const statusResult = validateCh13CompletionStatus(
      input.ch13AuditCompletionStatus,
      'Audit Completion Status',
    );
    if (!statusResult.valid) reasonMap.ch13AuditCompletionStatus = statusResult;

    const tprStatusResult = validateCh13CompletionStatus(
      input.ch13TprCompletionStatus,
      'TPR Completion Status',
    );
    if (!tprStatusResult.valid) reasonMap.ch13TprCompletionStatus = tprStatusResult;

    const yearResult = validateCh13CompletionYear(
      input.ch13AuditCompletionYear,
      'Audit Completion Year',
    );
    if (!yearResult.valid) reasonMap.ch13AuditCompletionYear = yearResult;

    const tprYearResult = validateCh13CompletionYear(
      input.ch13TprCompletionYear,
      'TPR Completion Year',
    );
    if (!tprYearResult.valid) reasonMap.ch13TprCompletionYear = tprYearResult;

    return Object.keys(reasonMap).length > 0 ? { reasonMap } : VALID;
  };
}

function requireValidEnum(
  field: keyof TrusteeUpcomingKeyDatesInput,
  validValues: readonly string[],
  label: string,
): ValidatorFunction {
  return (obj: unknown): ValidatorResult => {
    const input = obj as TrusteeUpcomingKeyDatesInput;
    const value = input[field];
    if (value !== null && !validValues.includes(value as string)) {
      return {
        reasonMap: {
          [field as string]: { reasons: [`${label} must be one of: ${validValues.join(', ')}.`] },
        },
      };
    }
    return VALID;
  };
}

function validateDateFields(): ValidatorFunction {
  return (obj: unknown): ValidatorResult => {
    const input = obj as TrusteeUpcomingKeyDatesInput;
    const reasonMap: ValidatorReasonMap = {};

    // Validate sentinel date fields (MM/DD format)
    const sentinelFields: DateField[] = [
      'tprDue',
      'tirReviewPeriodStart',
      'tirReviewPeriodEnd',
      'tirSubmission',
      'tirReview',
      'tirSemiAnnualReviewPeriodStart',
      'tirSemiAnnualReviewPeriodEnd',
      'tirSemiAnnualSubmission',
      'tirSemiAnnualReview',
    ];

    sentinelFields.forEach((field) => {
      const result = validateMonthDay(input[field]);
      if (!result.valid) {
        reasonMap[field] = result;
      }
    });

    // Validate full date fields (MM/DD/YYYY format)
    const fullDateFields: DateField[] = [
      'pastBackgroundQuestion',
      'pastFieldExam',
      'pastAudit',
      'pastTprSubmission',
      'lastTprSubmitted',
      'tprReviewPeriodStart',
      'tprReviewPeriodEnd',
      'lastMonthlyReportReceived',
      'leaseExpiration',
      'idExpiration',
      'lastCompensationStudy',
      'bondIssuedDate',
      'bondRenewalDate',
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
    validateCh13CompletionFields(),
    requirePair(
      'tprReviewPeriodStart',
      'tprReviewPeriodEnd',
      'TPR Review Period Start',
      'TPR Review Period End',
    ),
    requireChronologicalOrder(
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
    requirePair(
      'tirSemiAnnualReviewPeriodStart',
      'tirSemiAnnualReviewPeriodEnd',
      'TIR Review Period 2 Start',
      'TIR Review Period 2 End',
    ),
    requirePair('tprDue', 'tprDueYearType', 'TPR Due', 'TPR Due Year Type'),
    requirePair(
      'auditCompletionYear',
      'auditCompletionStatus',
      'Field Exam/Audit Completion Status Year',
      'Field Exam/Audit Completion Status',
    ),
    requirePair(
      'tprCompletionYear',
      'tprCompletionStatus',
      'Trustee Performance Review Completion Status Year',
      'Trustee Performance Review Completion Status',
    ),
    requirePair(
      'tirCompletionYear',
      'tirCompletionStatus',
      'Trustee Interim Report Completion Status Year',
      'Trustee Interim Report Completion Status',
    ),
    requirePair(
      'ch13AuditCompletionYear',
      'ch13AuditCompletionStatus',
      'Audit Completion Year',
      'Audit Completion Status',
    ),
    requirePair(
      'ch13TprCompletionYear',
      'ch13TprCompletionStatus',
      'TPR Completion Year',
      'TPR Completion Status',
    ),
    requireValidEnum(
      'auditCompletionStatus',
      ['CLOSED', 'NOT_CLOSED'],
      'Field Exam/Audit Completion Status',
    ),
    requireValidEnum(
      'tprCompletionStatus',
      ['COMPLETE', 'INCOMPLETE'],
      'Trustee Performance Review Completion Status',
    ),
    requireValidEnum(
      'tirCompletionStatus',
      ['COMPLETE', 'INCOMPLETE'],
      'Trustee Interim Report Completion Status',
    ),
    requirePair(
      'annualReportCompletionYear',
      'annualReportCompletionStatus',
      'Annual Report Completion Status Year',
      'Annual Report Completion Status',
    ),
    requireValidEnum(
      'annualReportCompletionStatus',
      ['COMPLETE', 'INCOMPLETE'],
      'Annual Report Completion Status',
    ),
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

/**
 * Validates that a two-field pair is either both set or both blank, for direct
 * per-render use on a card's dedicated edit form (mirrors validateTprDuePair's
 * blur-time-feedback role, but for any Year+Status-shaped pair -- completion
 * status, exam/audit year+type, or frequency+period).
 */
export function validateCompletionPairPresence(
  first: number | string | '' | null | undefined,
  second: number | string | '' | null | undefined,
  label: string,
  fieldNames: { first: string; second: string } = { first: 'Year', second: 'Status' },
): string {
  const firstSet = first !== '' && first !== null && first !== undefined;
  const secondSet = second !== '' && second !== null && second !== undefined;
  if (firstSet === secondSet) return '';
  return `${label} ${fieldNames.first} and ${fieldNames.second} must both be set.`;
}

/**
 * Completion status for a report in a given year, stored alongside its paired
 * completion year.
 */
export type CompletionStatus = 'COMPLETE' | 'INCOMPLETE';

/**
 * Validates chronological order for the TPR review period start/end pair,
 * for blur-time and per-render use (mirrors validateTprDuePair's role).
 * Returns per-field errors when start comes after end, null when valid.
 */
export function validateTprReviewPeriodOrder(
  start: string | null | undefined,
  end: string | null | undefined,
): { startError: string; endError: string } | null {
  if (!isPeriodOutOfOrder(start ?? null, end ?? null)) return null;
  return {
    startError: 'TPR Review Period Start must be before TPR Review Period End.',
    endError: 'TPR Review Period End must be after TPR Review Period Start.',
  };
}

export type TrusteeUpcomingKeyDates = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES';
    trusteeId: string;
    appointmentId: string;
    pastBackgroundQuestion?: string;
    pastFieldExam?: string;
    pastAudit?: string;
    pastTprSubmission?: string;
    lastTprSubmitted?: string;
    tprReviewPeriodStart?: string;
    tprReviewPeriodEnd?: string;
    tprDue?: string;
    tprDueYearType?: 'EVEN' | 'ODD';
    tprFrequency?: 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL';
    tirReviewPeriodStart?: string;
    tirReviewPeriodEnd?: string;
    tirSubmission?: string;
    tirReview?: string;
    upcomingExamOrAuditYear?: number;
    upcomingExamOrAuditType?: 'Field Exam' | 'Audit';
    tirFrequency?: 'ANNUAL' | 'SEMI_ANNUAL';
    tirSemiAnnualReviewPeriodStart?: string;
    tirSemiAnnualReviewPeriodEnd?: string;
    tirSemiAnnualSubmission?: string;
    tirSemiAnnualReview?: string;
    lastAuditFiscalYear?: number;
    auditCompletionYear?: number;
    auditCompletionStatus?: 'CLOSED' | 'NOT_CLOSED';
    tprCompletionYear?: number;
    tprCompletionStatus?: CompletionStatus;
    tirCompletionYear?: number;
    tirCompletionStatus?: CompletionStatus;
    annualReportCompletionYear?: number;
    annualReportCompletionStatus?: CompletionStatus;
    lastMonthlyReportReceived?: string;
    leaseExpiration?: string;
    idExpiration?: string;
    lastCompensationStudy?: string;
    bondIssuedDate?: string;
    bondRenewalDate?: string;
    ch13AuditCompletionYear?: number;
    ch13AuditCompletionStatus?: 'Complete' | 'Incomplete';
    ch13TprCompletionYear?: number;
    ch13TprCompletionStatus?: 'Complete' | 'Incomplete';
  };

export type TrusteeUpcomingKeyDatesInput = {
  trusteeId: string;
  appointmentId: string;
  pastBackgroundQuestion: string | null;
  pastFieldExam: string | null;
  pastAudit: string | null;
  pastTprSubmission: string | null;
  lastTprSubmitted: string | null;
  tprReviewPeriodStart: string | null;
  tprReviewPeriodEnd: string | null;
  tprDue: string | null;
  tprDueYearType: string | null;
  tprFrequency: 'BIANNUAL' | 'ANNUAL' | 'SEMI_ANNUAL' | null;
  tirReviewPeriodStart: string | null;
  tirReviewPeriodEnd: string | null;
  tirSubmission: string | null;
  tirReview: string | null;
  upcomingExamOrAuditYear: number | null;
  upcomingExamOrAuditType: 'Field Exam' | 'Audit' | null;
  tirFrequency: 'ANNUAL' | 'SEMI_ANNUAL' | null;
  tirSemiAnnualReviewPeriodStart: string | null;
  tirSemiAnnualReviewPeriodEnd: string | null;
  tirSemiAnnualSubmission: string | null;
  tirSemiAnnualReview: string | null;
  lastAuditFiscalYear: number | null;
  auditCompletionYear: number | null;
  auditCompletionStatus: 'CLOSED' | 'NOT_CLOSED' | null;
  tprCompletionYear: number | null;
  tprCompletionStatus: CompletionStatus | null;
  tirCompletionYear: number | null;
  tirCompletionStatus: CompletionStatus | null;
  annualReportCompletionYear: number | null;
  annualReportCompletionStatus: CompletionStatus | null;
  lastMonthlyReportReceived: string | null;
  leaseExpiration: string | null;
  idExpiration: string | null;
  lastCompensationStudy: string | null;
  bondIssuedDate: string | null;
  bondRenewalDate: string | null;
  ch13AuditCompletionYear: number | null;
  ch13AuditCompletionStatus: 'Complete' | 'Incomplete' | null;
  ch13TprCompletionYear: number | null;
  ch13TprCompletionStatus: 'Complete' | 'Incomplete' | null;
};

export type TrusteeUpcomingKeyDatesHistory = AbstractTrusteeHistory<
  Partial<TrusteeUpcomingKeyDates>,
  Partial<TrusteeUpcomingKeyDates>
> & {
  documentType: 'AUDIT_UPCOMING_REPORT_DATES';
  appointmentId: string;
};

type DateField =
  | 'pastBackgroundQuestion'
  | 'pastFieldExam'
  | 'pastAudit'
  | 'pastTprSubmission'
  | 'lastTprSubmitted'
  | 'tprReviewPeriodStart'
  | 'tprReviewPeriodEnd'
  | 'tprDue'
  | 'tirReviewPeriodStart'
  | 'tirReviewPeriodEnd'
  | 'tirSubmission'
  | 'tirReview'
  | 'tirSemiAnnualReviewPeriodStart'
  | 'tirSemiAnnualReviewPeriodEnd'
  | 'tirSemiAnnualSubmission'
  | 'tirSemiAnnualReview'
  | 'lastMonthlyReportReceived'
  | 'leaseExpiration'
  | 'idExpiration'
  | 'lastCompensationStudy'
  | 'bondIssuedDate'
  | 'bondRenewalDate';

export const DATE_FIELDS: DateField[] = [
  'pastBackgroundQuestion',
  'pastFieldExam',
  'pastAudit',
  'pastTprSubmission',
  'lastTprSubmitted',
  'tprReviewPeriodStart',
  'tprReviewPeriodEnd',
  'tprDue',
  'tirReviewPeriodStart',
  'tirReviewPeriodEnd',
  'tirSubmission',
  'tirReview',
  'tirSemiAnnualReviewPeriodStart',
  'tirSemiAnnualReviewPeriodEnd',
  'tirSemiAnnualSubmission',
  'tirSemiAnnualReview',
  'lastMonthlyReportReceived',
  'leaseExpiration',
  'idExpiration',
  'lastCompensationStudy',
  'bondIssuedDate',
  'bondRenewalDate',
];

type TextField =
  | 'tprDueYearType'
  | 'tprFrequency'
  | 'tirFrequency'
  | 'auditCompletionStatus'
  | 'tprCompletionStatus'
  | 'tirCompletionStatus'
  | 'annualReportCompletionStatus'
  | 'ch13AuditCompletionStatus'
  | 'ch13TprCompletionStatus';

export const TEXT_FIELDS: TextField[] = [
  'tprDueYearType',
  'tprFrequency',
  'tirFrequency',
  'auditCompletionStatus',
  'tprCompletionStatus',
  'tirCompletionStatus',
  'annualReportCompletionStatus',
  'ch13AuditCompletionStatus',
  'ch13TprCompletionStatus',
];

/**
 * Fields whose values are neither ISO date strings (DATE_FIELDS) nor short enum
 * strings (TEXT_FIELDS), but still only need `!== null` truthiness to copy/diff --
 * a mix of numbers and the one non-enum-named string field, upcomingExamOrAuditType.
 */
type ScalarField =
  | 'lastAuditFiscalYear'
  | 'upcomingExamOrAuditYear'
  | 'upcomingExamOrAuditType'
  | 'auditCompletionYear'
  | 'tprCompletionYear'
  | 'tirCompletionYear'
  | 'annualReportCompletionYear'
  | 'ch13AuditCompletionYear'
  | 'ch13TprCompletionYear';

export const SCALAR_FIELDS: ScalarField[] = [
  'lastAuditFiscalYear',
  'upcomingExamOrAuditYear',
  'upcomingExamOrAuditType',
  'auditCompletionYear',
  'tprCompletionYear',
  'tirCompletionYear',
  'annualReportCompletionYear',
  'ch13AuditCompletionYear',
  'ch13TprCompletionYear',
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
  ];
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  for (const qe of quarterEnds) {
    if (month < qe.month || (month === qe.month && day <= qe.day)) {
      return new Date(year, qe.month, qe.day);
    }
  }
  return new Date(year, 11, 31);
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

export function calculateAuditReqBy(lastAuditFiscalYear: number | null | undefined): number | null {
  if (lastAuditFiscalYear == null) return null;
  return lastAuditFiscalYear + 3;
}

export function calculateTprDueYear(yearType: 'EVEN' | 'ODD', currentYear: number): number {
  const yearIsEven = currentYear % 2 === 0;
  const typeIsEven = yearType === 'EVEN';
  return yearIsEven === typeIsEven ? currentYear : currentYear + 1;
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
