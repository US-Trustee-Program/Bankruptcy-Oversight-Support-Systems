import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput, buildYearOptions } from './chapter7PanelKeyDatesInput';

export function getCompletionYearOptions(): number[] {
  return buildYearOptions('backward', 11);
}

/**
 * Defaults every field of TrusteeUpcomingKeyDatesInput from the previously-saved record.
 * Each Chapter 13 Standing key-dates form (Audit, Other) spreads this and then
 * overrides only the handful of fields it owns with its own form state.
 *
 * auditCompletionYear/Status, tirCompletionYear/Status, and annualReportCompletionYear/Status
 * belong to other appointment domains (Chapter 7 Panel, and Chapter 12/13 Case by Case,
 * respectively) and a Chapter 13 Standing appointment never legitimately owns them, so
 * they're hard-nulled here rather than carried forward from `original` -- passing through
 * stale/foreign values would fail validation and, since upsert does a full document
 * replace, this also self-heals any document that already has legacy data in those fields.
 *
 * tprCompletionYear/Status is NOT hard-nulled here: Chapter 13 Standing's own TPR form
 * (TrusteePerformanceReportForm with variant="chapter13-standing") writes to these same
 * fields, so Audit/Other saves must carry them forward untouched.
 */
export function buildKeyDatesInputFromOriginal(
  trusteeId: string,
  appointmentId: string,
  original: TrusteeUpcomingKeyDates | null,
): TrusteeUpcomingKeyDatesInput {
  return mergeKeyDatesInput({ trusteeId, appointmentId }, original, {
    auditCompletionYear: null,
    auditCompletionStatus: null,
    tirCompletionYear: null,
    tirCompletionStatus: null,
    annualReportCompletionYear: null,
    annualReportCompletionStatus: null,
  });
}
