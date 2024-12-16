import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { MeController } from '../../../lib/controllers/me/me.controller';

const MODULE_NAME = 'ME-FUNCTION';

export async function handler(
  request: HttpRequest,
  functionContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(functionContext);
  try {
    const applicationContext = await ContextCreator.applicationContextCreator(
      functionContext,
      logger,
      request,
    );
    const meController = new MeController();
    const response = await meController.handleRequest(applicationContext);
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
