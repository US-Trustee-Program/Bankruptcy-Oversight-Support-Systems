import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import factory from '../../factory';

const MODULE_NAME = 'CASE-TRUSTEE-APPOINTMENT-USE-CASE';

export { MODULE_NAME };

export class CaseTrusteeAppointmentUseCase {
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  async getActiveCaseAppointment(caseId: string): Promise<CaseAppointment | null> {
    const repo = factory.getTrusteeAppointmentsRepository(this.context);
    return repo.getActiveCaseAppointment(caseId);
  }
}
