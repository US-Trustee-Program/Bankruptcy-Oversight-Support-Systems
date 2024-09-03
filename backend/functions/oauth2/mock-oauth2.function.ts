import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { mockAuthentication } from '../lib/testing/mock-gateways/mock-oauth2-gateway';
import { toAzureError, toAzureSuccess } from '../azure/functions';
import { httpSuccess } from '../lib/adapters/utils/http-response';

const MODULE_NAME = 'MOCK-OAUTH2-FUNCTION' as const;

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);
  try {
    const applicationContext = await ContextCreator.getApplicationContext({
      invocationContext,
      logger,
      request,
    });
    const token = await mockAuthentication(applicationContext);
    return toAzureSuccess(
      httpSuccess({
        body: { data: { value: token } },
      }),
    );
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
