import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { NotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { getCamsUserReference } from '@common/cams/session';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-USE-CASE';

export class TrusteeMatchVerificationUseCase {
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
      );
    } catch (originalError) {
      context.observability.completeTrace(trace, 'TrusteeMatchVerificationResolved', {
        success: false,
        properties: { action: 'reject' },
        measurements: {},
      });
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
      const casesRepo = factory.getCasesRepository(context);
      const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

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

      // 2. Update SyncedCase.trusteeId if needed (case may not be synced yet — treat as optional)
      let syncedCase = null;
      try {
        syncedCase = await casesRepo.getSyncedCase(verification.caseId);
      } catch (e) {
        if (!(e instanceof NotFoundError)) throw e;
      }
      if (syncedCase && syncedCase.trusteeId !== resolvedTrusteeId) {
        await casesRepo.syncDxtrCase({ ...syncedCase, trusteeId: resolvedTrusteeId });
      }

      // 3. Soft-close existing CaseAppointment if for a different trustee; create new one
      const existingAppointment = await appointmentsRepo.getActiveCaseAppointment(
        verification.caseId,
      );
      if (existingAppointment && existingAppointment.trusteeId !== resolvedTrusteeId) {
        await appointmentsRepo.updateCaseAppointment({ ...existingAppointment, unassignedOn: now });
      }
      if (!existingAppointment || existingAppointment.trusteeId !== resolvedTrusteeId) {
        await appointmentsRepo.createCaseAppointment({
          caseId: verification.caseId,
          trusteeId: resolvedTrusteeId,
          assignedOn: now,
        });
      }

      // 4. Mark verification as approved
      const userRef = getCamsUserReference(context.session.user);
      await repo.update(id, {
        status: 'approved',
        resolvedTrusteeId,
        resolvedTrusteeName,
        updatedBy: userRef,
        updatedOn: now,
      });

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
      );
    } catch (originalError) {
      context.observability.completeTrace(trace, 'TrusteeMatchVerificationResolved', {
        success: false,
        properties: { action: 'approve' },
        measurements: {},
      });
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
