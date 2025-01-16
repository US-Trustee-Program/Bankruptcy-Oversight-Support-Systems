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
    const applicationContext = await ContextCreator.getApplicationContext({
      invocationContext,
      logger,
      request,
    });
    const controller = new PrivilegedIdentityAdminController();
    const response = await controller.handleRequest(applicationContext);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('admin', {
  methods: ['DELETE', 'GET', 'PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'dev-tools/privileged-identity/{resourceId}',
});