import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { NotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { getCamsUserReference } from '@common/cams/session';

const MODULE_NAME = 'TRUSTEE-MATCH-VERIFICATION-USE-CASE';

export class TrusteeMatchVerificationUseCase {
  async approveVerification(
    context: ApplicationContext,
    id: string,
    resolvedTrusteeId: string,
  ): Promise<void> {
    try {
      const repo = factory.getTrusteeMatchVerificationRepository(context);
      const casesRepo = factory.getCasesRepository(context);
      const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

      // 1. Find the pending verification
      const all = await repo.search({ status: ['pending'] });
      const verification = all.find((v) => v.id === id);
      if (!verification) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Pending verification ${id} not found.`,
        });
      }

      const now = new Date().toISOString();

      // 2. Update SyncedCase.trusteeId if needed
      const syncedCase = await casesRepo.getSyncedCase(verification.caseId);
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
        updatedBy: userRef,
        updatedOn: now,
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
