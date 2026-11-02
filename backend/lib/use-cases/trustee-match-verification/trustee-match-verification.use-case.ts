import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { NotFoundError } from '../../common-errors/not-found-error';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsError } from '../../common-errors/cams-error';
import factory from '../../factory';
import { getCamsUserReference } from '@common/cams/session';
import {
  EnrichedTrusteeMatchVerification,
  TrusteeMatchVerificationListItem,
  TrusteeMatchVerificationSearchResult,
} from '@common/cams/trustee-match-verification';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import { OrderStatus } from '@common/cams/orders';
import { rankCandidates } from '@common/cams/trustee-match-pipeline';
import { CourtsUseCase } from '../courts/courts';
import CaseManagement from '../cases/case-management';
import { getCaseIdParts, getCaseNumber, CaseSummary } from '@common/cams/cases';
import { CourtDivisionDetails } from '@common/cams/courts';
import { createAuditRecord } from '@common/cams/auditable';
import { Creatable } from '@common/cams/creatable';
import { TRUSTEE_VARIATION_DOCUMENT_TYPE, TrusteeVariation } from '@common/cams/trustee-variation';
import { isAppointmentMatch } from '@common/cams/trustee-appointments';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-USE-CASE';
const VALID_STATUSES: OrderStatus[] = ['pending', 'approved'];

// Defensive sanity cap only — the fingerprint-keyed model expects a handful of cases per
// variant (see this slice's ~2.2% fragmentation figure), not the hundreds a case-keyed model
// used to produce. This is not real pagination; exceeding it just logs a warning.
const AFFECTED_CASE_COUNT_SANITY_CAP = 50;

// Caps simultaneous DXTR getCaseSummary lookups during approval -- AFFECTED_CASE_COUNT_SANITY_CAP
// above only logs past 50 affected cases, it never bounds anything, so without this a large
// fingerprint bundle would fire that many concurrent DXTR queries inside one synchronous request.
const CASE_SUMMARY_FETCH_CONCURRENCY = 10;

type VerificationListParams = {
  statusParam?: string;
};

function pendingVerificationNotFound(id: string): NotFoundError {
  return new NotFoundError(MODULE_NAME, {
    message: `Pending verification ${id} not found.`,
  });
}

export class TrusteeMatchVerificationUseCase {
  async getVerifications(
    context: ApplicationContext,
    params: VerificationListParams,
  ): Promise<TrusteeMatchVerificationListItem[]> {
    try {
      const parsedStatuses = (params.statusParam ?? '')
        .split(',')
        .map((s) => s.trim() as OrderStatus)
        .filter((s) => VALID_STATUSES.includes(s));

      // A statusParam was given but none of it survived validation (e.g. the shared
      // Data Verification "Rejected" filter, which trustee-match no longer supports) —
      // that's a request for statuses that can't exist here, not "no filter given". Return
      // no results rather than falling through to the no-filter default below, which would
      // otherwise silently substitute pending verifications for the (always-empty) requested set.
      if (params.statusParam && parsedStatuses.length === 0) {
        return [];
      }

      const status: OrderStatus[] = parsedStatuses.length > 0 ? parsedStatuses : ['pending'];

      const repo = factory.getTrusteeMatchVerificationRepository(context);
      const results = await repo.search({ status });

      const courts = await new CourtsUseCase().getCourts(context);
      const resultsWithoutSnapshot = results.filter(
        (verification) => !verification.affectedCaseIds,
      );
      const affectedCaseIdsByFingerprint = await this.getAffectedCaseIdsByFingerprint(
        context,
        resultsWithoutSnapshot.map((v) => v.fingerprint),
      );
      return results.map((verification) => {
        const affectedCaseIds =
          verification.affectedCaseIds ??
          affectedCaseIdsByFingerprint.get(verification.fingerprint) ??
          [];
        return {
          ...verification,
          courtName: this.resolveCourtName(verification, courts) ?? verification.courtName,
          affectedCaseIds,
          affectedCaseCount: affectedCaseIds.length,
        };
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  /**
   * Case membership for a fingerprint is derived, never stored: it is answered by querying
   * trustee-case-appointments for the surrogate rows written while a mismatch is pending (see
   * trustee-match.helpers.ts/sync-trustee-case-appointments.ts).
   *
   * Batched across every fingerprint in one query (getSurrogatesByFingerprints) rather than one
   * query per fingerprint — the list endpoint calls this once for its whole page instead of once
   * per row, avoiding an N+1 query pattern on an endpoint reviewers hit repeatedly to work
   * through the backlog.
   */
  private async getAffectedCaseIdsByFingerprint(
    context: ApplicationContext,
    fingerprints: string[],
  ): Promise<Map<string, string[]>> {
    if (fingerprints.length === 0) return new Map();

    const appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
    const uniqueFingerprints = [...new Set(fingerprints)];
    const surrogates = await appointmentsRepo.getSurrogatesByFingerprints(uniqueFingerprints);

    const affectedCaseIdsByFingerprint = new Map<string, string[]>();
    for (const surrogate of surrogates) {
      const caseIds = affectedCaseIdsByFingerprint.get(surrogate.trusteeId) ?? [];
      caseIds.push(surrogate.caseId);
      affectedCaseIdsByFingerprint.set(surrogate.trusteeId, caseIds);
    }

    for (const [fingerprint, caseIds] of affectedCaseIdsByFingerprint) {
      if (caseIds.length > AFFECTED_CASE_COUNT_SANITY_CAP) {
        context.logger.warn(
          MODULE_NAME,
          `Fingerprint ${fingerprint} affects ${caseIds.length} cases, exceeding the sanity cap of ${AFFECTED_CASE_COUNT_SANITY_CAP}.`,
        );
      }
    }

    return affectedCaseIdsByFingerprint;
  }

  /**
   * Fetches case summaries for every affected case, capped at CASE_SUMMARY_FETCH_CONCURRENCY
   * simultaneous lookups rather than firing one per case all at once. Preserves caseIds' order
   * in the returned array (each batch is itself order-preserving, and batches run sequentially),
   * so callers can zip results back to case IDs by index exactly as a single
   * Promise.allSettled over the whole list would.
   */
  private async fetchCaseSummariesBatched(
    context: ApplicationContext,
    caseManagement: CaseManagement,
    caseIds: string[],
  ): Promise<PromiseSettledResult<CaseSummary>[]> {
    const results: PromiseSettledResult<CaseSummary>[] = [];
    for (let i = 0; i < caseIds.length; i += CASE_SUMMARY_FETCH_CONCURRENCY) {
      const batch = caseIds.slice(i, i + CASE_SUMMARY_FETCH_CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((caseId) => caseManagement.getCaseSummary(context, caseId)),
      );
      results.push(...batchResults);
    }
    return results;
  }

  private resolveCourtName(
    verification: TrusteeMatchVerificationSearchResult,
    courts: CourtDivisionDetails[],
  ): string | undefined {
    const findByCourtIdOnly = () => courts.find((c) => c.courtId === verification.courtId);

    let court: CourtDivisionDetails | undefined;
    if (verification.caseId) {
      try {
        const { divisionCode } = getCaseIdParts(verification.caseId);
        court = courts.find(
          (c) => c.courtDivisionCode === divisionCode || c.courtId === verification.courtId,
        );
      } catch {
        court = findByCourtIdOnly();
      }
    } else {
      court = findByCourtIdOnly();
    }

    if (!court) return undefined;
    return court.courtDivisionName
      ? `${court.courtName} - ${court.courtDivisionName}`
      : court.courtName;
  }

  async approveVerification(
    context: ApplicationContext,
    id: string,
    resolvedTrusteeId: string,
    resolvedTrusteeName?: string,
  ): Promise<void> {
    const trace = context.observability.startTrace(context.invocationId);
    try {
      const repo = factory.getTrusteeMatchVerificationRepository(context);

      // 1. Find the pending verification
      const verification = await repo.findById(id);
      if (verification.status !== 'pending') {
        throw pendingVerificationNotFound(id);
      }

      const resolutionMs = verification.createdOn
        ? Date.now() - new Date(verification.createdOn).getTime()
        : 0;
      // Telemetry reads the candidates in the same pipeline rank order the verifier saw them in:
      // the top-ranked candidate is the preselected one, and rank is 1-based.
      const rankedTrusteeIds = rankCandidates(verification.findings.candidates).map(
        (candidate) => candidate.camsRaw.trusteeId,
      );
      const wasPreselectedConfirmed = rankedTrusteeIds[0] === resolvedTrusteeId;
      const resolutionPath = wasPreselectedConfirmed ? 'accepted' : 'manual-search';
      const candidateIdx = rankedTrusteeIds.indexOf(resolvedTrusteeId);
      const selectedCandidateRank = candidateIdx >= 0 ? candidateIdx + 1 : undefined;

      const now = new Date().toISOString();
      const userRef = getCamsUserReference(context.session.user);

      // 2. Snapshot affected case IDs while surrogates are still live — the remap job
      // enqueued later deletes them, and this is the only remaining chance to read them.
      // Computed before any write below so the division check that follows can reject the
      // whole approval before anything is persisted.
      const affectedCaseIdsByFingerprint = await this.getAffectedCaseIdsByFingerprint(context, [
        verification.fingerprint,
      ]);
      const affectedCaseIds = affectedCaseIdsByFingerprint.get(verification.fingerprint) ?? [];

      // 3. Reject the whole approval if the resolved trustee's configured divisions don't
      // cover every affected case's court+chapter+division — the same match rule the
      // auto-match pipeline already trusts (isAppointmentMatch). A single fingerprint can
      // affect multiple cases, potentially spanning different divisions within the same
      // court, so this must check every affected case, not just verification.caseId. This
      // is necessarily all-or-nothing: approval is one atomic status flip for the whole
      // verification, so there's no partial-approval option if only some cases match.
      if (affectedCaseIds.length > 0) {
        const trusteeAppointments = await factory
          .getTrusteeAppointmentsRepository(context)
          .getTrusteeAppointments(resolvedTrusteeId);
        const caseManagement = new CaseManagement(context);
        // allSettled rather than all: a lookup failure for one case (stale/closed case,
        // transient gateway timeout) is a different failure mode than a real division
        // mismatch -- this method's all-or-nothing behavior is specifically about division
        // coverage, not about case-lookup reliability, so the two must surface as distinct,
        // non-conflatable errors rather than both failing identically. Batched (not one
        // Promise.allSettled over the whole list) so a large affected-case bundle can't fire
        // dozens of simultaneous DXTR queries inside this one synchronous request.
        const caseSummaryResults = await this.fetchCaseSummariesBatched(
          context,
          caseManagement,
          affectedCaseIds,
        );
        const failedCaseIds = affectedCaseIds.filter(
          (_caseId, index) => caseSummaryResults[index].status === 'rejected',
        );
        if (failedCaseIds.length > 0) {
          throw new CamsError(MODULE_NAME, {
            message: `Unable to verify division coverage for case(s): ${failedCaseIds.join(', ')}. Approval was not processed; retry once the lookup succeeds.`,
          });
        }
        const caseSummaries = caseSummaryResults
          .filter(
            (result): result is PromiseFulfilledResult<CaseSummary> =>
              result.status === 'fulfilled',
          )
          .map((result) => result.value);
        const uncoveredCaseIds = caseSummaries
          .filter(
            (summary) =>
              !isAppointmentMatch(
                trusteeAppointments,
                summary.courtId,
                summary.courtDivisionCode,
                summary.chapter,
              ),
          )
          .map((summary) => summary.caseId);
        if (uncoveredCaseIds.length > 0) {
          const trusteeLabel = resolvedTrusteeName ?? resolvedTrusteeId;
          const caseNumbers = uncoveredCaseIds.map((caseId) => getCaseNumber(caseId)).join(', ');
          throw new BadRequestError(MODULE_NAME, {
            message: `${trusteeLabel} is not assigned to the division(s) for case(s): ${caseNumbers}. Choose a different candidate or search for a trustee whose appointments cover these cases.`,
          });
        }
      }

      // 4. Record the resolved fingerprint/variant mapping so future auto-matching
      // short-circuits on it — mirrors autoLinkTrustee's TRUSTEE_VARIATION write on the
      // sync path. Bucket+verify: fetch the fingerprint's bucket, compare variant exactly.
      const variationRepo = factory.getTrusteeVariationRepository(context);
      const variationBucket = await variationRepo.findByFingerprint(verification.fingerprint);
      const existingVariation = variationBucket.find((v) => v.variant === verification.variant);
      if (!existingVariation) {
        await variationRepo.createVariation(
          createAuditRecord<Creatable<TrusteeVariation>>(
            {
              documentType: TRUSTEE_VARIATION_DOCUMENT_TYPE,
              fingerprint: verification.fingerprint,
              variant: verification.variant,
              trusteeId: resolvedTrusteeId,
            },
            userRef,
          ),
        );
      }

      // 5. Persist the approval and its affectedCaseIds snapshot BEFORE enqueueing the
      // remap. The snapshot is the durable record we most need to protect: if this write
      // throws, the verification stays 'pending' and retryable, and no remap message has
      // gone out yet, so nothing downstream has acted on stale data.
      // The write is a compare-and-set from 'pending': if a concurrent approval already won, no
      // document matches, the remap below is never enqueued, and this approval is rejected.
      const approvedNow = await repo.updateIfPending(id, {
        status: 'approved',
        resolvedTrusteeId,
        resolvedTrusteeName,
        affectedCaseIds,
        remap: { status: 'pending' },
        updatedBy: userRef,
        updatedOn: now,
      });
      if (!approvedNow) {
        throw pendingVerificationNotFound(id);
      }

      // 6. Enqueue the async batch remap now that the approval is durably recorded. Every
      // surrogate CaseAppointment sharing this fingerprint (not just verification.caseId)
      // gets remapped to resolvedTrusteeId by the queue-triggered trustee-verification-remap
      // handler. handleRemap is idempotent, so a redelivered or duplicate message just finds
      // no surrogates left and no-ops. If this enqueue throws, the approval above already
      // succeeded and will not be retried through this endpoint (status is no longer
      // 'pending') — the error is rethrown as-is so it surfaces loudly rather than being
      // swallowed, since surrogates for this fingerprint will remain unmapped until the
      // remap is retriggered by other means.
      const apiToDataflows = factory.getApiToDataflowsGateway(context);
      const remapMessage: TrusteeVerificationRemapMessage = {
        fingerprint: verification.fingerprint,
        resolvedTrusteeId,
        resolvedTrusteeName,
        verificationId: id,
      };
      await apiToDataflows.queueTrusteeVerificationRemap(remapMessage);

      context.observability.completeTrace(
        trace,
        'TrusteeMatchVerificationResolved',
        {
          success: true,
          properties: {
            action: 'approve',
            ...(verification.caseId !== undefined ? { caseId: verification.caseId } : {}),
            mismatchReason: verification.mismatchReason,
            wasPreselectedConfirmed: String(wasPreselectedConfirmed),
            resolutionPath,
            ...(selectedCandidateRank !== undefined
              ? { selectedCandidateRank: String(selectedCandidateRank) }
              : {}),
          },
          measurements: {
            resolutionMs,
            candidateCount: rankedTrusteeIds.length,
          },
        },
        [{ name: 'TrusteeVerificationResolutionMs', value: resolutionMs }],
        context.logger,
      );
    } catch (originalError) {
      context.observability.completeTrace(
        trace,
        'TrusteeMatchVerificationResolved',
        {
          success: false,
          properties: { action: 'approve' },
          measurements: {},
        },
        undefined,
        context.logger,
      );
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getEnrichedVerification(
    context: ApplicationContext,
    id: string,
  ): Promise<EnrichedTrusteeMatchVerification> {
    try {
      const repo = factory.getTrusteeMatchVerificationRepository(context);
      const trusteesRepo = factory.getTrusteesRepository(context);

      const verification = await repo.findById(id);
      let affectedCaseIds: string[];
      if (verification.status === 'approved') {
        // Only approveVerification writes a snapshot, so read it for approved verifications.
        affectedCaseIds = verification.affectedCaseIds ?? [];
      } else {
        // Pending and (legacy, read-only) rejected verifications have no snapshot — rejection
        // never touched surrogates, and pending hasn't been resolved yet — so derive live in
        // both cases.
        const affectedCaseIdsByFingerprint = await this.getAffectedCaseIdsByFingerprint(context, [
          verification.fingerprint,
        ]);
        affectedCaseIds = affectedCaseIdsByFingerprint.get(verification.fingerprint) ?? [];
      }

      // Approval stores resolvedTrusteeName; read the trustee only when it is missing.
      let resolvedTrusteeName = verification.resolvedTrusteeName;
      if (
        verification.status === 'approved' &&
        verification.resolvedTrusteeId &&
        !resolvedTrusteeName
      ) {
        try {
          const resolved = await trusteesRepo.read(verification.resolvedTrusteeId);
          resolvedTrusteeName = resolved.name;
        } catch {
          // name unavailable — UI falls back to trustee ID
        }
      }

      return {
        ...verification,
        resolvedTrusteeName,
        affectedCaseIds,
      };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
