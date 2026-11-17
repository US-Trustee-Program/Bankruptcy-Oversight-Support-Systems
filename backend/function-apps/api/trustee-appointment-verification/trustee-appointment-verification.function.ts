import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeAppointmentVerificationController } from '../../../lib/controllers/trustee-appointment-verification/trustee-appointment-verification.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'TRUSTEE-APPOINTMENT-VERIFICATION-FUNCTION';

dotenv.config();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      request,
      logger,
    });

    const controller = new TrusteeAppointmentVerificationController();
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (camsError) {
    return toAzureError(logger, MODULE_NAME, camsError);
  }
}

app.http('trustee-appointment-verification', {
  methods: ['GET', 'PATCH'],
  authLevel: 'anonymous',
  handler,
  route: 'trustee-appointment-verification/{id?}',
});
