import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { PrivilegedIdentityAdminController } from '../../../lib/controllers/admin/privileged-identity-admin.controller';

const MODULE_NAME = 'PRIVILEGED-IDENTITY-ADMIN-FUNCTION';

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

    const controller = new PrivilegedIdentityAdminController();
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('privileged-identity-admin', {
  methods: ['DELETE', 'GET', 'PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'dev-tools/privileged-identity/{resourceId?}',
});
