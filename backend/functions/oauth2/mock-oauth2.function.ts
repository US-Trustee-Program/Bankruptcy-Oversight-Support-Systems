import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { mockAuthentication } from '../lib/testing/mock-gateways/mock-oauth2-gateway';
import { toAzureError, toAzureSuccess } from '../azure/functions';

const MODULE_NAME = 'MOCK-OAUTH2-FUNCTION' as const;

export default async function handler(
  request: HttpRequest,
  functionContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    functionContext,
    request,
  );
  try {
    const token = await mockAuthentication(applicationContext);
    return toAzureSuccess({ token });
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    return toAzureError(applicationContext, MODULE_NAME, camsError);
  }
}

app.http('oauth2', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler,
  route: 'oauth2/default',
});
