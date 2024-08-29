import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { mockAuthentication } from '../lib/testing/mock-gateways/mock-oauth2-gateway';
import { toAzureError, toAzureSuccess } from '../azure/functions';

const MODULE_NAME = 'MOCK-OAUTH2-FUNCTION' as const;

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);
  try {
    const applicationContext = await ContextCreator.applicationContextCreator(
      invocationContext,
      request,
      logger,
    );
    const token = await mockAuthentication(applicationContext);
    return toAzureSuccess({ token });
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('oauth2', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler,
  route: 'oauth2/default',
});
