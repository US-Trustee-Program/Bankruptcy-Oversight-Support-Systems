import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../azure/functions';

const MODULE_NAME = 'ME-FUNCTION';

export async function handler(
  request: HttpRequest,
  functionContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    functionContext,
    request,
  );
  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);
    const response = { success: true, body: applicationContext.session };
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(applicationContext, MODULE_NAME, error);
  }
}

app.http('handler', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'me',
});

export default handler;
