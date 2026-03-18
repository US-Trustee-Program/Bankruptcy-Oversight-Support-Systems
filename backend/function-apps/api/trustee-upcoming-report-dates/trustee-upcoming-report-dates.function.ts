import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { TrusteeUpcomingReportDatesController } from '../../../lib/controllers/trustee-upcoming-report-dates/trustee-upcoming-report-dates.controller';

const MODULE_NAME = 'TRUSTEE-UPCOMING-REPORT-DATES-FUNCTION';

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

    const controller = new TrusteeUpcomingReportDatesController(context);
    const controllerResponse = await controller.handleRequest(context);
    return toAzureSuccess(controllerResponse);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trustee-upcoming-report-dates', {
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'trustees/{trusteeId}/appointments/{appointmentId}/upcoming-report-dates',
});
