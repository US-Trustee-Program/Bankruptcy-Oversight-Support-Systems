import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { ListsController } from '../../../lib/controllers/lists/lists.controller';

const MODULE_NAME = 'LISTS-FUNCTION';

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

    const controller = new ListsController();
    context.session = await ContextCreator.getApplicationContextSession(context);

    const responseBody = await controller.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('lists', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'lists/{listName}',
});
