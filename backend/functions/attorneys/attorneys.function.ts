import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AttorneysController } from '../lib/controllers/attorneys/attorneys.controller';
import { initializeApplicationInsights } from '../azure/app-insights';
import { azureToCamsHttpRequest, toAzureError, toAzureSuccess } from '../azure/functions';
import ContextCreator from '../azure/application-context-creator';

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

    const camsRequest = await azureToCamsHttpRequest(request);
    const attorneysList = await attorneysController.getAttorneyList(camsRequest);
    return toAzureSuccess(attorneysList);
  } catch (error) {
    return toAzureError(applicationContext, MODULE_NAME, error);
  }
}

app.http('attorneys', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'attorneys/{id:int?}',
});
