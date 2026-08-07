import { ApplicationContext } from '../../adapters/types/basic';
import {
  CaseAppointment,
  CaseTrusteeAppointmentHistory,
  CaseTrusteeAppointmentHistoryItem,
} from '@common/cams/trustee-appointments';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { SENTINEL_TRUSTEE_ID } from '../dataflows/migrate-case-appointments-constants';

const MODULE_NAME = 'CASE-TRUSTEE-APPOINTMENT-USE-CASE';

/** A surrogate or ACMS-sentinel row is a placeholder, never a case's real trustee. */
function isPlaceholderAppointment(appointment: CaseAppointment): boolean {
  return !!appointment.isSurrogate || appointment.trusteeId === SENTINEL_TRUSTEE_ID;
}

export class CaseTrusteeAppointmentUseCase {
  async getActiveCaseAppointment(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseAppointment | null> {
    try {
      const repo = factory.getTrusteeCaseAppointmentsRepository(context);
      // getActiveByCaseId already excludes surrogate and sentinel placeholder rows at the
      // query level, so its result is always the case's real active appointment (or null).
      return await repo.getActiveByCaseId(caseId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  async getCaseTrusteeAppointmentHistory(
    context: ApplicationContext,
    caseId: string,
  ): Promise<CaseTrusteeAppointmentHistory> {
    try {
      const repo = factory.getTrusteeCaseAppointmentsRepository(context);
      const trusteesRepo = factory.getTrusteesRepository(context);

      const all = await repo.getByCaseId(caseId);
      // getByCaseId is unfiltered — a case can have a real active appointment AND an active
      // surrogate/sentinel placeholder at the same time, so the active row must be selected
      // by excluding placeholders, not just by "no unassignedOn".
      const current = all.find((a) => !a.unassignedOn && !isPlaceholderAppointment(a)) ?? null;
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
