import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import factory from '../../factory';

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
