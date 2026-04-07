import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { NotFoundError } from '../../common-errors/not-found-error';
import { CaseTrusteeAppointmentUseCase } from '../../use-cases/cases/case-trustee-appointment.use-case';
import { CaseAppointment } from '@common/cams/trustee-appointments';

const MODULE_NAME = 'CASE-TRUSTEE-APPOINTMENT-CONTROLLER';

export class CaseTrusteeAppointmentController {
  async handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit<CaseAppointment>> {
    const caseId = context.request.params['caseId'];
    const useCase = new CaseTrusteeAppointmentUseCase(context);
    const appointment = await useCase.getActiveCaseAppointment(caseId);
    if (!appointment) {
      throw new NotFoundError(MODULE_NAME, {
        message: `No active trustee appointment for case ${caseId}`,
      });
    }
    return httpSuccess({
      body: {
        meta: { self: context.request.url },
        data: appointment,
      },
    });
  }
}
