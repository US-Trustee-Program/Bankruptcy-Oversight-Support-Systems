import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { OfficesController } from '../lib/controllers/offices/offices.controller';
import { azureToCamsHttpRequest, toAzureError, toAzureSuccess } from '../azure/functions';

const MODULE_NAME = 'OFFICES_FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const officesController = new OfficesController(applicationContext);

  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const camsRequest = await azureToCamsHttpRequest(request);
    const responseBody = await officesController.getOffices(camsRequest);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(applicationContext, MODULE_NAME, error);
  }
}

app.http('offices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'offices',
});
