import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { OfficesController } from '../lib/controllers/offices/offices.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { httpRequestToCamsHttpRequest } from '../azure/functions';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const officesController = new OfficesController(applicationContext);

  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const camsRequest = await httpRequestToCamsHttpRequest(request);
    const responseBody = await officesController.getOffices(camsRequest);
    return httpSuccess(responseBody);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    return httpError(camsError);
  }
}

app.http('offices', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'offices',
});
