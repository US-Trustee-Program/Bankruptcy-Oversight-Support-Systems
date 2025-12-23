import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeAppointmentsController } from '../../../lib/controllers/trustee-appointments/trustee-appointments.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-FUNCTION';

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

    context.session = await ContextCreator.getApplicationContextSession(context);
    const trusteeAppointmentsController = new TrusteeAppointmentsController(context);

    const responseBody = await trusteeAppointmentsController.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trustee-appointments', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'trustees/{trusteeId}/appointments',
});
