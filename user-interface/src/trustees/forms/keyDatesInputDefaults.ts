import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput } from './chapter7PanelKeyDatesInput';

const currentYear = new Date().getFullYear();
export const COMPLETION_YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => currentYear - i);

/**
 * Defaults every field of TrusteeUpcomingKeyDatesInput from the previously-saved record.
 * Each Chapter 13 Standing key-dates form spreads this and then overrides only the
 * handful of fields it owns with its own form state.
 *
 * auditCompletionYear/Status, tprCompletionYear/Status, tirCompletionYear/Status, and
 * annualReportCompletionYear/Status belong to other appointment domains (Chapter 7
 * Panel, and Chapter 12/13 Case by Case, respectively -- different value sets than
 * Ch13's own ch13AuditCompletionStatus/ch13TprCompletionStatus) and a Chapter 13
 * Standing appointment never legitimately owns them, so they're hard-nulled here
 * rather than carried forward from `original` -- passing through stale/foreign values
 * would fail validation and, since upsert does a full document replace, this also
 * self-heals any document that already has legacy data in those fields.
 */
export function buildKeyDatesInputFromOriginal(
  trusteeId: string,
  appointmentId: string,
  original: TrusteeUpcomingKeyDates | null,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput({ trusteeId, appointmentId }, original, {
    auditCompletionYear: null,
    auditCompletionStatus: null,
    tprCompletionYear: null,
    tprCompletionStatus: null,
    tirCompletionYear: null,
    tirCompletionStatus: null,
    annualReportCompletionYear: null,
    annualReportCompletionStatus: null,
  });
}
