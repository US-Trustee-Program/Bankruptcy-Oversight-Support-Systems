import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { NotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { getCamsUserReference } from '@common/cams/session';
import {
  EnrichedTrusteeMatchVerification,
  TrusteeCandidate,
  TrusteeMatchVerificationListItem,
  TrusteeMatchVerificationSearchResult,
} from '@common/cams/trustee-match-verification';
import {
  TrusteeAppointmentSyncErrorCode,
  TrusteeVerificationRemapMessage,
} from '@common/cams/dataflow-events';
import { OrderStatus } from '@common/cams/orders';
import { CourtsUseCase } from '../courts/courts';
import { getCaseIdParts } from '@common/cams/cases';
import { CourtDivisionDetails } from '@common/cams/courts';
import { createAuditRecord } from '@common/cams/auditable';
import { Creatable } from '@common/cams/creatable';
import { TRUSTEE_VARIATION_DOCUMENT_TYPE, TrusteeVariation } from '@common/cams/trustee-variation';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-USE-CASE';
const VALID_STATUSES: OrderStatus[] = ['pending', 'approved', 'rejected'];

// Defensive sanity cap only — the fingerprint-keyed model expects a handful of cases per
// variant (see this slice's ~2.2% fragmentation figure), not the hundreds a case-keyed model
// used to produce. This is not real pagination; exceeding it just logs a warning.
const AFFECTED_CASE_COUNT_SANITY_CAP = 50;

type VerificationListParams = {
  statusParam?: string;
};

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
      const status: OrderStatus[] = parsedStatuses.length > 0 ? parsedStatuses : ['pending'];

      const repo = factory.getTrusteeMatchVerificationRepository(context);
      const results = await repo.search({ status });

      const courts = await new CourtsUseCase().getCourts(context);
      return await Promise.all(
        results.map(async (verification) => {
          const { matchCandidates, ...rest } = verification;
          const affectedCaseIds = await this.getAffectedCaseIds(context, verification.fingerprint);
          return {
            ...rest,
            courtName: this.resolveCourtName(verification, courts) ?? verification.courtName,
            candidateCount: matchCandidates.length,
            preselectedCandidate: this.resolvePreselectedCandidate(verification),
            affectedCaseCount: affectedCaseIds.length,
          };
        }),
      );
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  /**
   * Case membership for a fingerprint is derived, never stored: it is answered by querying
   * trustee-case-appointments for the surrogate rows written while a mismatch is pending (see
   * trustee-match.helpers.ts/sync-trustee-case-appointments.ts).
   */
  private async getAffectedCaseIds(
    context: ApplicationContext,
    fingerprint: string,
  ): Promise<string[]> {
    const appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
    const surrogates = await appointmentsRepo.getSurrogatesByFingerprint(fingerprint);
    const affectedCaseIds = surrogates.map((appointment) => appointment.caseId);

    if (affectedCaseIds.length > AFFECTED_CASE_COUNT_SANITY_CAP) {
      context.logger.warn(
        MODULE_NAME,
        `Fingerprint ${fingerprint} affects ${affectedCaseIds.length} cases, exceeding the sanity cap of ${AFFECTED_CASE_COUNT_SANITY_CAP}.`,
      );
    }

    return affectedCaseIds;
  }

  private resolvePreselectedCandidate(
    verification: TrusteeMatchVerificationSearchResult,
  ): TrusteeCandidate | null {
    if (verification.matchCandidates.length === 0) return null;
    const isMultipleMatch =
      verification.mismatchReason === TrusteeAppointmentSyncErrorCode.MultipleTrusteesMatch;
    const best = isMultipleMatch
      ? verification.matchCandidates.reduce((a, b) => (b.totalScore > a.totalScore ? b : a))
      : verification.matchCandidates[0];
    return { trusteeId: best.trusteeId, trusteeName: best.trusteeName };
  }

  private resolveCourtName(
    verification: TrusteeMatchVerificationSearchResult,
    courts: CourtDivisionDetails[],
  ): string | undefined {
    try {
      const { divisionCode } = getCaseIdParts(verification.caseId);
      const court = courts.find(
        (c) => c.courtDivisionCode === divisionCode || c.courtId === verification.courtId,
      );
      if (!court) return undefined;
      return court.courtDivisionName
        ? `${court.courtName} - ${court.courtDivisionName}`
        : court.courtName;
    } catch {
      const court = courts.find((c) => c.courtId === verification.courtId);
      if (!court) return undefined;
      return court.courtDivisionName
        ? `${court.courtName} - ${court.courtDivisionName}`
        : court.courtName;
    }
  }

  async rejectVerification(
    context: ApplicationContext,
    id: string,
    reason?: string,
  ): Promise<void> {
    const trace = context.observability.startTrace(context.invocationId);
    try {
      const repo = factory.getTrusteeMatchVerificationRepository(context);
      const verification = await repo.findById(id);
      if (verification.status !== 'pending') {
        throw new NotFoundError(MODULE_NAME, {
          message: `Pending verification ${id} not found.`,
        });
      }
      const resolutionMs = verification.createdOn
        ? Date.now() - new Date(verification.createdOn).getTime()
        : 0;
      const now = new Date().toISOString();
      const userRef = getCamsUserReference(context.session.user);
      await repo.update(id, {
        status: 'rejected',
        reason,
        updatedBy: userRef,
        updatedOn: now,
      });
      context.observability.completeTrace(
        trace,
        'TrusteeMatchVerificationResolved',
        {
          success: true,
          properties: {
            action: 'reject',
            caseId: verification.caseId,
            mismatchReason: verification.mismatchReason,
            resolutionPath: 'escalated',
          },
          measurements: {
            resolutionMs,
            candidateCount: verification.matchCandidates.length,
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
          properties: { action: 'reject' },
          measurements: {},
        },
        undefined,
        context.logger,
      );
      throw getCamsError(originalError, MODULE_NAME);
    }
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
        throw new NotFoundError(MODULE_NAME, {
          message: `Pending verification ${id} not found.`,
        });
      }

      const resolutionMs = verification.createdOn
        ? Date.now() - new Date(verification.createdOn).getTime()
        : 0;
      const preselectedTrusteeId =
        verification.matchCandidates.length > 0
          ? verification.matchCandidates.reduce((best, c) =>
              c.totalScore > best.totalScore ? c : best,
            ).trusteeId
          : undefined;
      const wasPreselectedConfirmed = preselectedTrusteeId === resolvedTrusteeId;

      // Calculate resolution path for telemetry
      const resolutionPath = wasPreselectedConfirmed ? 'accepted' : 'manual-search';

      // Calculate selected candidate rank (1-based index); undefined if not found in candidates
      const candidateIdx = verification.matchCandidates.findIndex(
        (c) => c.trusteeId === resolvedTrusteeId,
      );
      const selectedCandidateRank = candidateIdx >= 0 ? candidateIdx + 1 : undefined;

      const now = new Date().toISOString();
      const userRef = getCamsUserReference(context.session.user);

      // 2. Record the resolved fingerprint/variant mapping so future auto-matching
      // short-circuits on it — mirrors recordAutoMatch's TRUSTEE_VARIATION write on the
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

      // 2b. Close the trustee-professional-ids mapping loop now that a human has
      // confirmed the trustee, using the professional ID carried on the verification doc.
      if (verification.acmsProfessionalId) {
        const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
        await professionalIdsRepo.createProfessionalId(
          resolvedTrusteeId,
          verification.acmsProfessionalId,
          userRef,
        );
      }

      // 3. Mark verification as approved
      await repo.update(id, {
        status: 'approved',
        resolvedTrusteeId,
        resolvedTrusteeName,
        updatedBy: userRef,
        updatedOn: now,
      });

      // 4. Enqueue the async batch remap — every surrogate CaseAppointment sharing this
      // fingerprint (not just verification.caseId) gets remapped to resolvedTrusteeId by
      // the queue-triggered trustee-verification-remap handler. Replaces the old inline
      // single-case appointment write, which only ever touched verification.caseId.
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
            caseId: verification.caseId,
            mismatchReason: verification.mismatchReason,
            wasPreselectedConfirmed: String(wasPreselectedConfirmed),
            resolutionPath,
            ...(selectedCandidateRank !== undefined
              ? { selectedCandidateRank: String(selectedCandidateRank) }
              : {}),
          },
          measurements: {
            resolutionMs,
            candidateCount: verification.matchCandidates.length,
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
      const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

      const verification = await repo.findById(id);
      const affectedCaseIds = await this.getAffectedCaseIds(context, verification.fingerprint);

      const enrichedCandidates = await Promise.all(
        verification.matchCandidates.map(async (candidate) => {
          try {
            const [trustee, appointments] = await Promise.all([
              trusteesRepo.read(candidate.trusteeId),
              appointmentsRepo.getTrusteeAppointments(candidate.trusteeId),
            ]);
            return {
              ...candidate,
              address: trustee.public.address,
              phone: trustee.public.phone,
              email: trustee.public.email,
              appointments,
            };
          } catch {
            return candidate;
          }
        }),
      );

      let resolvedTrusteeName = verification.resolvedTrusteeName;
      if (
        verification.status === 'approved' &&
        verification.resolvedTrusteeId &&
        !resolvedTrusteeName &&
        !enrichedCandidates.find((c) => c.trusteeId === verification.resolvedTrusteeId)
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
        matchCandidates: enrichedCandidates,
        resolvedTrusteeName,
        affectedCaseIds,
      };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
