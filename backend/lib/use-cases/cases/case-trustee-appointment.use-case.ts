import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment } from '@common/cams/trustee-appointments';
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
}
