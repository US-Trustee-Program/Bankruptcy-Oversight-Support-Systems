import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
// import { AdminController } from '../../../lib/controllers/admin/admin.controller';
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
    logger.info(
      MODULE_NAME,
      `${request.params.procedure} procedure triggered by ${request.user.username}.`,
    );
    return toAzureSuccess({
      body: { data: { procedure: request.params.procedure, user: request.user.username } },
    });
    // const controller = new AdminController();
    // const response = await controller.handleRequest(applicationContext);
    // return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('admin', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler,
  route: 'dev-tools/{procedure}',
});
