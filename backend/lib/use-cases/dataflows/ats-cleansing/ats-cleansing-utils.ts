import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { AtsAppointmentRecord } from '../../../adapters/types/ats.types';

/**
 * Normalize value for comparison (case-insensitive, trim, handle NULL)
 */
export function normalizeForComparison(value: string | null | undefined): string {
  if (!value || value.toUpperCase() === 'NULL') {
    return '';
  }
  return value.trim().toUpperCase();
}

/**
 * Split multi-value field on delimiters (comma, slash, ampersand, "and")
 */
export function splitMultiValue(value: string | null | undefined): string[] {
  if (!value || value === 'NULL') {
    return [];
  }
  // Split on comma, slash, ampersand, or 'and'
  const parts = value.split(/[,/&]|\sand\s/i);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Create a unique key for an appointment to prevent duplicates.
 * Division is optional - only included in key if present.
 */
export function getAppointmentKey(trusteeId: string, appointment: TrusteeAppointmentInput): string {
  const divisionPart = appointment.divisionCode ? `-${appointment.divisionCode}` : '';
  return `${trusteeId}-${appointment.courtId}${divisionPart}-${appointment.chapter}-${appointment.appointmentType}`;
}

/**
 * Copy an ATS appointment record (shallow copy)
 */
export function copyAppointmentRecord(record: AtsAppointmentRecord): AtsAppointmentRecord {
  return { ...record };
}
