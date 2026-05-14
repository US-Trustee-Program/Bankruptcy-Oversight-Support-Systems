import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment, CaseTrusteeAppointmentHistory } from '@common/cams/trustee-appointments';
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
      const all = await repo.findByCaseId(caseId);
      const current = all.find((a) => !a.unassignedOn) ?? null;
      const history = all
        .filter((a) => !!a.unassignedOn)
        .sort((a, b) => b.unassignedOn!.localeCompare(a.unassignedOn!));
      return { current, history };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
