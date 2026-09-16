import { formatDate } from '@/lib/utils/datetime';
import { AppointmentStatus } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';

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

export function buildDistrictDisplay(
  appointment: Pick<TrusteeAppointment, 'courtName' | 'courtId'>,
): string {
  if (appointment.courtName) {
    return appointment.courtName;
  }
  return `Court ${appointment.courtId}`;
}
