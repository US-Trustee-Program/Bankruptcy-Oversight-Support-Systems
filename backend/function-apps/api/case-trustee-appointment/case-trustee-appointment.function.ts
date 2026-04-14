import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { CaseTrusteeAppointmentController } from '../../../lib/controllers/cases/case-trustee-appointment.controller';

const MODULE_NAME = 'CASE-TRUSTEE-APPOINTMENT-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      logger,
      request,
    });

    const controller = new CaseTrusteeAppointmentController();
    const camsResponse = await controller.handleRequest(context);
    return toAzureSuccess(camsResponse);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('case-trustee-appointment', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId}/trustee-appointment',
});
