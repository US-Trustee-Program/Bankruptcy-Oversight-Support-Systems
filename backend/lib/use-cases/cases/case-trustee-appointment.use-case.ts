import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';

const MODULE_NAME = 'CASE-TRUSTEE-APPOINTMENT-USE-CASE';

export class CaseTrusteeAppointmentUseCase {
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  async getActiveCaseAppointment(caseId: string): Promise<CaseAppointment | null> {
    try {
      const repo = factory.getTrusteeAppointmentsRepository(this.context);
      return await repo.getActiveCaseAppointment(caseId);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}
