import { formatDate } from '@/lib/utils/datetime';

const UNIX_EPOCH = '1970-01-01';

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
