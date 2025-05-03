import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

import { PrivilegedIdentityAdminController } from '../../../lib/controllers/admin/privileged-identity-admin.controller';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'PRIVILEGED-IDENTITY-ADMIN-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator({
    invocationContext,
    request,
  });

  try {
    const controller = new PrivilegedIdentityAdminController();
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('privileged-identity-admin', {
  authLevel: 'anonymous',
  handler,
  methods: ['DELETE', 'GET', 'PUT'],
  route: 'dev-tools/privileged-identity/{resourceId?}',
});
