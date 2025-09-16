import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteesController } from '../../../lib/controllers/trustees/trustees.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'TRUSTEES-FUNCTION';

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

    context.session = await ContextCreator.getApplicationContextSession(context);
    const trusteesController = new TrusteesController(context);

    const responseBody = await trusteesController.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trustees', {
  methods: ['GET', 'PATCH', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'trustees/{id?}',
});
