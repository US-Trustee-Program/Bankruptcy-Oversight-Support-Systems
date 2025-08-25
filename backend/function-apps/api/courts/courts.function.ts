import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { CourtsController } from '../../../lib/controllers/courts/courts.controller';

const MODULE_NAME = 'COURTS-FUNCTION';

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

    const controller = new CourtsController();
    // Courts endpoint doesn't require authentication for dropdown data
    // context.session = await ContextCreator.getApplicationContextSession(context);

    const responseBody = await controller.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('courts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'courts',
});
