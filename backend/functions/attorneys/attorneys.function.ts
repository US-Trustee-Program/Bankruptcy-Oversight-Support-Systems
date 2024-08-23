import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { AttorneysController } from '../lib/controllers/attorneys/attorneys.controller';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import * as dotenv from 'dotenv';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { initializeApplicationInsights } from '../azure/app-insights';
import { httpRequestToCamsHttpRequest } from '../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ATTORNEYS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  functionContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    functionContext,
    request,
  );
  const attorneysController = new AttorneysController(applicationContext);

  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const camsRequest = httpRequestToCamsHttpRequest(request);
    const attorneysList = await attorneysController.getAttorneyList(camsRequest);
    return httpSuccess(attorneysList);
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    return httpError(error);
  }
}

app.http('attorneys', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'attorneys',
});
