import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { StaffAdminController } from '../../../lib/controllers/admin/staff-admin.controller';
import { UnauthorizedError } from '../../../lib/common-errors/unauthorized-error';
import { AdminRequestBody } from '../../../lib/adapters/types/http';

const MODULE_NAME = 'ADMIN-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const applicationContext = await ContextCreator.getApplicationContext<AdminRequestBody>({
      invocationContext,
      logger,
      request,
    });
    if (applicationContext.request.body.apiKey !== process.env.ADMIN_KEY) {
      throw new UnauthorizedError(MODULE_NAME, {
        message: 'API key was missing or did not match.',
      });
    }
    const controller = new StaffAdminController();
    const response = await controller.handleRequest(applicationContext);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('admin', {
  methods: ['DELETE', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'dev-tools/staff/{procedure}',
});
