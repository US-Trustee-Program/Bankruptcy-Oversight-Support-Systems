import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { OfficesController } from '../lib/controllers/offices/offices.controller';
import { toAzureError, toAzureSuccess } from '../azure/functions';

const MODULE_NAME = 'OFFICES_FUNCTION';

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
    const officesController = new OfficesController(applicationContext);
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const responseBody = await officesController.handleRequest(applicationContext);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('offices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'offices',
});
