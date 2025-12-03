import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { mockAuthentication } from '../../../lib/testing/mock-gateways/mock-oauth2-gateway';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { httpSuccess } from '../../../lib/adapters/utils/http-response';

const MODULE_NAME = 'OAUTH2-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.getApplicationContext({
    invocationContext,
    request,
  });
  try {
    const token: string = await mockAuthentication(context);
    return toAzureSuccess(
      httpSuccess({
        body: { data: { value: token } },
      }),
    );
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('oauth2', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler,
  route: 'oauth2/default',
});
