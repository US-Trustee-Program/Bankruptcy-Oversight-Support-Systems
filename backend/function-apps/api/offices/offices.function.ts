import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { OfficesController } from '../../../lib/controllers/offices/offices.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'OFFICES-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator({
    invocationContext,
    request,
  });
  try {
    const officesController = new OfficesController();
    context.session = await ContextCreator.getApplicationContextSession(context);

    const responseBody = await officesController.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('offices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'offices/{officeCode?}/{subResource?}',
});
