import { CompletionStatus } from '@common/cams/trustee-upcoming-key-dates';
import { EditableTableCardTag } from '@/lib/components/cams/EditableTableCard/EditableTableCard';

/**
 * Builds the completion status tag shown on a key-dates card.
 *
 * The year and status are stored as a pair, so a tag is only meaningful when
 * both are present — a status with no year has nothing to report on, and a year
 * with no status has nothing to say about it.
 */
export function buildCompletionTag(
  id: string,
  year: number | undefined,
  status: CompletionStatus | undefined,
): EditableTableCardTag | undefined {
  if (!year || !status) {
    return undefined;
  }
  return {
    id,
    label: `${status} for ${year}`,
    color: status === 'Complete' ? 'green' : 'red',
  };
}
