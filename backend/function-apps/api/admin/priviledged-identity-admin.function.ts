import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { PriviledgedIdentityAdminController } from '../../../lib/controllers/admin/priviledged-identity-admin.controller';

const MODULE_NAME = 'PRIVILEDGED-IDENTITY-ADMIN-FUNCTION';

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
    const controller = new PriviledgedIdentityAdminController();
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
  route: 'dev-tools/priviledged-identity/{resourceId}',
});
