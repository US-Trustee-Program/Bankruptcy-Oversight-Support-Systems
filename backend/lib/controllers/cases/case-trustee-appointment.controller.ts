import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { BadRequestError } from '../../common-errors/bad-request';
import { NotFoundError } from '../../common-errors/not-found-error';
import { CaseTrusteeAppointmentUseCase } from '../../use-cases/cases/case-trustee-appointment.use-case';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { getCaseIdParts } from '@common/cams/cases';

const MODULE_NAME = 'CASE-TRUSTEE-APPOINTMENT-CONTROLLER';

export class CaseTrusteeAppointmentController {
  async handleRequest(context: ApplicationContext): Promise<CamsHttpResponseInit<CaseAppointment>> {
    const caseId = context.request.params['caseId'];
    try {
      getCaseIdParts(caseId);
    } catch {
      throw new BadRequestError(MODULE_NAME, { message: 'Invalid caseId format.' });
    }
    const useCase = new CaseTrusteeAppointmentUseCase();
    const appointment = await useCase.getActiveCaseAppointment(context, caseId);
    if (!appointment) {
      throw new NotFoundError(MODULE_NAME, {
        message: 'No active trustee appointment found.',
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
