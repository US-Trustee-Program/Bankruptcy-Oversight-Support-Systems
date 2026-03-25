import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { TrusteeUpcomingKeyDatesController } from '../../../lib/controllers/trustee-upcoming-key-dates/trustee-upcoming-key-dates.controller';

const MODULE_NAME = 'TRUSTEE-UPCOMING-KEY-DATES-FUNCTION';

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

    const controller = new TrusteeUpcomingKeyDatesController(context);
    const controllerResponse = await controller.handleRequest(context);
    return toAzureSuccess(controllerResponse);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trustee-upcoming-key-dates', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'trustees/{trusteeId}/appointments/{appointmentId}/upcoming-key-dates',
});
