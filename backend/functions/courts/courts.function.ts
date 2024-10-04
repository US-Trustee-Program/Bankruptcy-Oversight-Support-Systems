import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../azure/functions';
import { CourtsController } from '../lib/controllers/courts/courts.controller';

const MODULE_NAME = 'COURTS_FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);
  try {
    const applicationContext = await ContextCreator.applicationContextCreator(
      invocationContext,
      logger,
      request,
    );
    const controller = new CourtsController();
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const responseBody = await controller.handleRequest(applicationContext);
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