import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

import { httpSuccess } from '../../../lib/adapters/utils/http-response';
import { mockAuthentication } from '../../../lib/testing/mock-gateways/mock-oauth2-gateway';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'MOCK-OAUTH2-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator({
    invocationContext,
    request,
  });
  try {
    const token = await mockAuthentication(context);
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
  authLevel: 'anonymous',
  handler,
  methods: ['POST'],
  route: 'oauth2/default',
});
