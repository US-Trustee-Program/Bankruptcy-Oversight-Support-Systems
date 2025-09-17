import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { MeController } from '../../../../lib/controllers/me/me.controller';
import ContextCreator from '../../../azure/application-context-creator';
import { toAzureSuccess, toAzureError } from '../../../azure/functions';

const MODULE_NAME = 'ME-FUNCTION';

export async function handler(
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

    const meController = new MeController();
    const response = await meController.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'me',
});

export default handler;
