import { formatDate } from '@/lib/utils/datetime';
import {
  AppointmentChapterType,
  AppointmentStatus,
  AppointmentType,
  getAppointmentDetails,
} from '@common/cams/trustees';

const UNIX_EPOCH = '1970-01-01';

export function isActiveAppointment(status: AppointmentStatus): boolean {
  return status === 'active';
}

/**
 * Format appointment date with special handling for sentinel values.
 * Unix epoch (1970-01-01) is used as a sentinel value during ATS migration
 * to indicate dates that were not specified in the source system.
 */
export function formatAppointmentDate(dateString: string): string {
  if (dateString.startsWith(UNIX_EPOCH)) {
    return 'Not Specified';
  }
  return formatDate(dateString);
}

/**
 * courtName and courtId are optional here even though TrusteeAppointment
 * requires courtId, because legacy/malformed data from the ATS migration
 * can still arrive without either field.
 */
export function buildDistrictDisplay(appointment: {
  courtName?: string;
  courtId?: string;
}): string {
  if (appointment.courtName) {
    return appointment.courtName;
  }
  if (appointment.courtId) {
    return `Court ${appointment.courtId}`;
  }
  return 'Court information not available';
}

/**
 * Single source of truth for the "district (division): Chapter X - Type" heading shown
 * both on the accordion appointment bodies and on each key-dates edit form's subheading,
 * so the two never drift out of sync.
 */
export function buildAppointmentHeading(appointment: {
  courtName?: string;
  courtId?: string;
  courtDivisionName?: string;
  chapter: AppointmentChapterType;
  appointmentType: AppointmentType;
}): string {
  const districtDisplay = buildDistrictDisplay(appointment);
  const divisionSuffix = appointment.courtDivisionName ? ` (${appointment.courtDivisionName})` : '';
  return `${districtDisplay}${divisionSuffix}: Chapter ${getAppointmentDetails(appointment.chapter, appointment.appointmentType)}`;
}
