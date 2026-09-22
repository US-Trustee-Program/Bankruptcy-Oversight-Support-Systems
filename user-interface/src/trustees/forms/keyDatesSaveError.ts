import { ValidatorResult, flattenReasonMap } from '@common/cams/validation';

/**
 * Turns a failed key-dates validation into a message worth showing the user.
 *
 * `validateTrusteeUpcomingKeyDates` validates the whole merged document, not
 * just the fields the current form renders, because every form round-trips the
 * fields it does not own. So a stale or unpaired value elsewhere in the
 * document fails the save of a form that cannot even display it.
 *
 * Errors on a field this form owns are reported plainly. Anything else is
 * reported as belonging to another part of the appointment, so the user is told
 * why Save is blocked instead of being handed a message pointing at a control
 * that is not on screen — or, worse, no message at all.
 */
export function resolveKeyDatesSaveError(
  reasonMap: Record<string, ValidatorResult> | undefined,
  ownedFields: readonly string[],
): string {
  if (!reasonMap) {
    return 'Please correct the highlighted fields.';
  }

  const flattened = Object.entries(flattenReasonMap(reasonMap)).map(([jsonPath, reasons]) => ({
    // flattenReasonMap emits '$.fieldName'; the leading segment is the document root.
    field: jsonPath.split('.')[1] ?? '',
    reason: reasons[0],
  }));

  const owned = flattened.find((entry) => ownedFields.includes(entry.field));
  if (owned?.reason) {
    return owned.reason;
  }

  const foreign = flattened.find((entry) => !!entry.reason);
  if (foreign) {
    return `This appointment has a problem in another section that must be fixed before saving: ${foreign.reason}`;
  }

  return 'Please correct the highlighted fields.';
}
