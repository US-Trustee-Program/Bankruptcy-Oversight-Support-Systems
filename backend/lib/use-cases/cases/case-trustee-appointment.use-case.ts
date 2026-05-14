import { ApplicationContext } from '../../adapters/types/basic';
import {
  CaseAppointment,
  CaseTrusteeAppointmentHistory,
  CaseTrusteeAppointmentHistoryItem,
} from '@common/cams/trustee-appointments';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'CASE-TRUSTEE-APPOINTMENT-USE-CASE';

export class CaseTrusteeAppointmentUseCase {
  async getActiveCaseAppointment(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseAppointment | null> {
    try {
      const repo = factory.getTrusteeAppointmentsRepository(context);
      return await repo.getActiveCaseAppointment(caseId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getCaseTrusteeAppointmentHistory(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseTrusteeAppointmentHistory> {
    try {
      const repo = factory.getTrusteeAppointmentsRepository(context);
      const trusteesRepo = factory.getTrusteesRepository(context);

      const all = await repo.findByCaseId(caseId);
      const current = all.find((a) => !a.unassignedOn) ?? null;
      const pastAppointments = all
        .filter((a) => !!a.unassignedOn)
        .sort((a, b) => b.unassignedOn!.localeCompare(a.unassignedOn!));

      // Resolve trustee names in parallel — failures are non-fatal
      const history: CaseTrusteeAppointmentHistoryItem[] = await Promise.all(
        pastAppointments.map(async (appt) => {
          try {
            const trustee = await trusteesRepo.read(appt.trusteeId);
            return { ...appt, trusteeName: trustee.name };
          } catch {
            return appt; // name resolution failed — return without trusteeName
          }
        }),
      );

      return { current, history };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
