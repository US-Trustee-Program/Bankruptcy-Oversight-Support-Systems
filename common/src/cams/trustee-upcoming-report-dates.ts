import { Auditable } from './auditable';
import { Identifiable } from './document';
import { AbstractTrusteeHistory } from './trustee-history-base';
import { VALID, ValidatorResult } from './validation';

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

export function validateMMDDYYYY(value: unknown): ValidatorResult {
  const error = { reasons: ['Must be a valid date mm/dd/yyyy.'] };
  if (typeof value !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return error;
  }
  const [month, day, year] = value.split('/');
  const iso = `${year}-${month}-${day}`;
  const date = new Date(iso);
  if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== iso) {
    return error;
  }
  return VALID;
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
  const iso = `2000-${month}-${day}`;
  const date = new Date(iso);
  if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== iso) {
    return error;
  }
  return VALID;
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
