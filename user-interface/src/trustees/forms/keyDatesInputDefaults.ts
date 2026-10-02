import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { mergeKeyDatesInput, buildYearOptions } from './keyDatesInput';

export function getCompletionYearOptions(): number[] {
  return buildYearOptions('backward', 11);
}

/**
 * Defaults every field of TrusteeUpcomingKeyDatesInput from the previously-saved record.
 * Each Chapter 13 Standing key-dates form (Audit, Other) spreads this and then
 * overrides only the handful of fields it owns with its own form state.
 *
 * auditCompletionYear/Status, tirCompletionYear/Status, annualReportCompletionYear/Status,
 * and ch13AuditCompletionYear/Status belong to specific owning forms -- the first three to
 * other appointment domains entirely (Chapter 7 Panel, and Chapter 12/13 Case by Case,
 * respectively), and ch13AuditCompletionYear/Status to Chapter13StandingAuditForm
 * specifically, not Chapter13StandingOtherForm (see cams-og9ys.11) -- so all four are
 * hard-nulled here rather than carried forward from `original`. Chapter13StandingAuditForm
 * immediately overrides the ch13Audit pair with its own form state after spreading this, so
 * nulling it here is a no-op for that form and a real fix for every other caller. Passing a
 * pair through unowned would fail validation and, since upsert does a full document
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
    ch13AuditCompletionYear: null,
    ch13AuditCompletionStatus: null,
  });
}
