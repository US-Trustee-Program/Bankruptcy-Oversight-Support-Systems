import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { assertValidChapter } from './sync-trustee-case-appointments';
import {
  CaseAppointment,
  TrusteeAppointment,
  isAppointmentMatch,
} from '@common/cams/trustee-appointments';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import { TrusteeCaseAppointmentsRepository } from '../gateways.types';
import CaseManagement from '../cases/case-management';
import { CaseSummary } from '@common/cams/cases';

const MODULE_NAME = 'TRUSTEE-VERIFICATION-REMAP-USE-CASE';

/**
 * A division/chapter mismatch found by remapSurrogateAppointment's defense-in-depth
 * re-validation is a PERMANENT condition -- the resolved trustee's appointments won't change
 * between remap attempts, so retrying this exact surrogate again will fail identically forever.
 * Distinguished from a generic per-case failure (CamsError/plain Error from a Cosmos write,
 * which genuinely might succeed on retry) so remapPage/handleRemap can stop re-queuing a page
 * that can never make progress, rather than looping on it indefinitely (reviewer-flagged on PR
 * #3090: a bundle larger than REMAP_PAGE_SIZE whose trustee doesn't cover any of it would
 * otherwise re-select and re-fail the identical first page forever, since a permanent failure
 * never deletes its surrogate and there's no cursor to skip past it).
 */
class RemapDivisionMismatchError extends Error {}

/**
 * A getCaseSummary failure is a DXTR lookup problem, not a division mismatch -- it carries no
 * information about whether the trustee covers the case at all, so it must never be counted
 * toward RemapPageResult.permanentFailureCount (which drives handleRemap's continuation
 * decision). Treated the same as isTooManyRequestsError/isGatewayTimeoutError: rethrown to
 * abort the page and let the queue's own retry/poison-queue mechanism handle it, rather than
 * being silently conflated with a genuine permanent mismatch (reviewer-verified: a transient
 * getCaseSummary failure against a fully covering trustee previously produced the exact same
 * per-case failure count as a real mismatch).
 */
class RemapCaseSummaryLookupError extends Error {}

type RemapPageResult = {
  documentsWritten: number;
  documentsFailed: number;
  /**
   * Count of surrogates in this page whose resolved trustee does not cover their
   * court+chapter+division, per the defense-in-depth re-validation below. Excluded from
   * documentsFailed (which represents failures that might succeed on retry) specifically so
   * handleRemap can tell "nothing in this page can ever succeed" from "something here might
   * work next time" when deciding whether to requeue a continuation.
   */
  permanentFailureCount: number;
  totalCandidates: number;
  pageSize: number;
  remainingCount: number;
};

class TrusteeVerificationRemapUseCase {
  private readonly context: ApplicationContext;
  private readonly appointmentsRepo: TrusteeCaseAppointmentsRepository;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
  }

  /**
   * Remaps a single surrogate CaseAppointment to the resolved real trustee: soft-close a
   * different-trustee real appointment if one exists (a genuine real->real trustee change,
   * a historical fact), upsert the canonical appointment under resolvedTrusteeId, then delete
   * the surrogate. Order is soft-close -> upsert -> delete: upserting before soft-closing would
   * transiently leave two active real rows (getActiveByCaseId's findOne would then return an
   * arbitrary one), whereas a failed upsert after a soft-close only leaves the case showing no
   * trustee — recoverable, and self-healing on retry since the surrogate is untouched until the
   * upsert succeeds. assignedOn is carried from the surrogate row (not stamped fresh) so the
   * upsert's natural key (caseId, trusteeId, assignedOn) makes retries genuinely idempotent.
   *
   * Re-validates isAppointmentMatch against a freshly-fetched case summary before remapping —
   * defense in depth against the race window in TrusteeMatchVerificationUseCase.approveVerification
   * between its own division-check snapshot and the TRUSTEE_VARIATION write that stops new
   * surrogates from joining this fingerprint's bucket. A surrogate admitted into the bucket
   * during that window would otherwise never have passed any division check at all. A mismatch
   * here throws RemapDivisionMismatchError, which remapPage's caller treats as a permanent
   * per-case failure (not an ordinary retryable one): the surrogate is left in place rather than
   * silently remapped to a division the trustee isn't assigned to, but it's also excluded from
   * the count that drives further continuation, since retrying it can never succeed.
   *
   * The getCaseSummary lookup itself is wrapped separately: a failure there says nothing about
   * division coverage, so it's rethrown as RemapCaseSummaryLookupError -- treated the same as a
   * rate-limit/gateway-timeout error (batch-level abort, let the queue's own retry handle it)
   * rather than risk being conflated with a genuine permanent mismatch.
   */
  private async remapSurrogateAppointment(
    surrogate: CaseAppointment,
    message: TrusteeVerificationRemapMessage,
    trusteeAppointments: TrusteeAppointment[],
  ): Promise<void> {
    const caseManagement = new CaseManagement(this.context);
    let caseSummary: CaseSummary;
    try {
      caseSummary = await caseManagement.getCaseSummary(this.context, surrogate.caseId);
    } catch (lookupError) {
      throw new RemapCaseSummaryLookupError(
        `Unable to look up case summary for ${surrogate.caseId}: ${(lookupError as Error).message}`,
      );
    }
    if (
      !isAppointmentMatch(
        trusteeAppointments,
        caseSummary.courtId,
        caseSummary.courtDivisionCode,
        caseSummary.chapter,
      )
    ) {
      throw new RemapDivisionMismatchError(
        `Resolved trustee ${message.resolvedTrusteeId} is not assigned to the division for case ${surrogate.caseId} -- skipping remap.`,
      );
    }

    const existingReal = await this.appointmentsRepo.getActiveByCaseId(surrogate.caseId);

    if (existingReal && existingReal.trusteeId !== message.resolvedTrusteeId) {
      await this.appointmentsRepo.updateCaseAppointment({
        ...existingReal,
        unassignedOn: new Date().toISOString(),
      });
    }

    if (!existingReal || existingReal.trusteeId !== message.resolvedTrusteeId) {
      await this.appointmentsRepo.upsert({
        caseId: surrogate.caseId,
        trusteeId: message.resolvedTrusteeId,
        assignedOn: surrogate.assignedOn,
        appointedDate: surrogate.appointedDate,
        dateFiled: surrogate.dateFiled,
        // Fresh values, not the surrogate's: the guard above validates isAppointmentMatch
        // against caseSummary specifically to catch a case transferred since the surrogate
        // was created, and persisting the surrogate's own chapter/courtDivisionCode here
        // would write back exactly the stale data that guard exists to catch.
        chapter: assertValidChapter(surrogate.caseId, caseSummary.chapter),
        courtDivisionCode: caseSummary.courtDivisionCode,
      });
    }

    await this.appointmentsRepo.delete(surrogate.id);
  }

  /**
   * Remaps up to pageSize cases sharing message.fingerprint's pending mismatch from their
   * surrogate placeholder to the resolved real trustee. Natural idempotency: a remapped case's
   * surrogate row is deleted outright, so re-querying getSurrogatesByFingerprint(fingerprint)
   * after a partial batch failure returns only the cases that haven't been remapped yet — no
   * retryCount-based skip logic is needed. The one case a retry may re-encounter is one whose
   * canonical upsert succeeded but whose surrogate delete failed; the idempotent upsert makes
   * reprocessing it a no-op and the retry completes the delete.
   *
   * A rate-limit error, gateway-timeout error, or case-summary lookup failure mid-page
   * rethrows immediately rather than being counted as a per-case failure — all three are
   * conditions the caller must back off and retry (same convention as isTransientInfraError in
   * sync-trustee-case-appointments.ts and resolveNameCollisionByScoring in
   * trustee-match.helpers.ts), not a permanent failure for the one case that happened to hit it
   * while the rest of the page is untouched. A genuine division mismatch, by contrast, is
   * counted in permanentFailureCount rather than documentsFailed or rethrown: it's a real
   * per-case outcome (the surrogate is correctly left unremapped), but retrying it can never
   * succeed, so it must not look like "might work next time" to handleRemap's continuation
   * decision.
   */
  async remapPage(
    message: TrusteeVerificationRemapMessage,
    pageSize: number,
  ): Promise<RemapPageResult> {
    const surrogates = await this.appointmentsRepo.getSurrogatesByFingerprint(message.fingerprint);
    const page = surrogates.slice(0, pageSize);
    const remainingCount = surrogates.length - page.length;

    // Fetched once per page, not per surrogate -- resolvedTrusteeId is fixed for the whole
    // message, so every surrogate in this page re-validates against the same appointment set.
    const trusteeAppointments = await factory
      .getTrusteeAppointmentsRepository(this.context)
      .getTrusteeAppointments(message.resolvedTrusteeId);

    let documentsWritten = 0;
    let documentsFailed = 0;
    let permanentFailureCount = 0;

    for (const surrogate of page) {
      try {
        await this.remapSurrogateAppointment(surrogate, message, trusteeAppointments);
        documentsWritten++;
      } catch (perCaseError) {
        if (
          isTooManyRequestsError(perCaseError) ||
          isGatewayTimeoutError(perCaseError) ||
          perCaseError instanceof RemapCaseSummaryLookupError
        ) {
          throw perCaseError;
        }
        if (perCaseError instanceof RemapDivisionMismatchError) {
          permanentFailureCount++;
          this.context.logger.error(
            MODULE_NAME,
            `Case ${surrogate.caseId} for fingerprint ${message.fingerprint} is permanently uncovered by the resolved trustee — its surrogate row is left in place, but will not be retried by this continuation.`,
            perCaseError,
          );
          continue;
        }
        documentsFailed++;
        this.context.logger.error(
          MODULE_NAME,
          `Failed to remap case ${surrogate.caseId} for fingerprint ${message.fingerprint} — its surrogate row is left in place for the next attempt to rediscover.`,
          perCaseError,
        );
      }
    }

    return {
      documentsWritten,
      documentsFailed,
      permanentFailureCount,
      totalCandidates: surrogates.length,
      pageSize: page.length,
      remainingCount,
    };
  }
}

export default TrusteeVerificationRemapUseCase;
