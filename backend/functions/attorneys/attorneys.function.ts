import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { AttorneysController } from '../lib/controllers/attorneys/attorneys.controller';
import { initializeApplicationInsights } from '../azure/app-insights';
import { toAzureError, toAzureSuccess } from '../azure/functions';
import ContextCreator from '../azure/application-context-creator';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ATTORNEYS-FUNCTION';

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
    const attorneysList = await AttorneysController.getAttorneyList(applicationContext);
    return toAzureSuccess(attorneysList);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('attorneys', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'attorneys/{id:int?}',
});
