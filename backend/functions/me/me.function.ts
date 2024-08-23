import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';

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
    return httpSuccess(response);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    return httpError(camsError);
  }
}

app.http('handler', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'me',
});

export default handler;
