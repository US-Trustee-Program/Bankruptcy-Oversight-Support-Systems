import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { CaseAppointmentSourceController } from '../../../lib/controllers/admin/case-appointment-source.controller';

const MODULE_NAME = 'CASE-APPOINTMENT-SOURCE-FUNCTION';

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

    context.session = await ContextCreator.getApplicationContextSession(context);
    const controller = new CaseAppointmentSourceController();
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('case-appointment-source', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'dev-tools/case-appointment-source',
});
