import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../azure/functions';
import { httpSuccess } from '../lib/adapters/utils/http-response';

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
    const response = httpSuccess({
      body: {
        data: applicationContext.session,
      },
    });
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('handler', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'me',
});

export default handler;
