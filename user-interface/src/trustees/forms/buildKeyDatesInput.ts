import {
  DATE_FIELDS,
  NUMBER_FIELDS,
  TEXT_FIELDS,
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';

/**
 * Builds a full key-dates PUT payload from the document that was loaded,
 * applying only the fields the caller's form actually owns.
 *
 * The API replaces the whole document, so a form that omits a field it does not
 * edit would silently clear it. Starting from `original` means a new field is
 * preserved by every form automatically, instead of each form needing to be
 * updated whenever the model grows.
 */
export function buildKeyDatesInput(
  ids: { trusteeId: string; appointmentId: string },
  original: TrusteeUpcomingKeyDates | null,
  overrides: Partial<TrusteeUpcomingKeyDatesInput> = {},
): TrusteeUpcomingKeyDatesInput {
  const preserved: Record<string, unknown> = {};
  for (const field of [...DATE_FIELDS, ...TEXT_FIELDS, ...NUMBER_FIELDS]) {
    preserved[field] = original?.[field] ?? null;
  }
  // Not part of the field-list constants, so it is carried over on its own.
  preserved.upcomingExamOrAuditType = original?.upcomingExamOrAuditType ?? null;

  return {
    ...(preserved as unknown as TrusteeUpcomingKeyDatesInput),
    ...overrides,
    trusteeId: ids.trusteeId,
    appointmentId: ids.appointmentId,
  };
}
