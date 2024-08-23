import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { mockAuthentication } from '../lib/testing/mock-gateways/mock-oauth2-gateway';

export async function handler(
  request: HttpRequest,
  functionContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    functionContext,
    request,
  );
  try {
    const token = await mockAuthentication(applicationContext);
    return httpSuccess({ token });
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    return httpError(camsError);
  }
}

app.http('handler', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler,
  route: 'oauth2/default',
});

export default handler;
