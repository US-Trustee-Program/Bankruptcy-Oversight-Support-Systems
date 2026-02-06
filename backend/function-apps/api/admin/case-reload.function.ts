import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureSuccess, toAzureError } from '../../azure/functions';
import { CaseReloadController } from '../../../lib/controllers/admin/case-reload.controller';

const MODULE_NAME = 'CASE-RELOAD-FUNCTION';

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

    const controller = new CaseReloadController();
    context.session = await ContextCreator.getApplicationContextSession(context);

    const responseBody = await controller.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('case-reload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler,
  route: 'dev-tools/case-reload',
});
