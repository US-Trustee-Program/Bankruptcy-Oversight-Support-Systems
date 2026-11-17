import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureSuccess, toAzureError } from '../../azure/functions';
import { TrusteeDataReportController } from '../../../lib/controllers/admin/trustee-data-report.controller';

const MODULE_NAME = 'TRUSTEE-DATA-REPORT-FUNCTION';

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

    const controller = new TrusteeDataReportController();
    context.session = await ContextCreator.getApplicationContextSession(context);

    const responseBody = await controller.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trustee-data-report', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'dev-tools/trustee-data-report',
});
