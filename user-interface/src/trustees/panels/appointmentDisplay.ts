import { formatDate } from '@/lib/utils/datetime';
import { AppointmentStatus } from '@common/cams/trustees';

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
  return `Court ${appointment.courtId}`;
}
