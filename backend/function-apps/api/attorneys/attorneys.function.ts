import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { AttorneysController } from '../../../lib/controllers/attorneys/attorneys.controller';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ATTORNEYS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator({
    invocationContext,
    request,
  });

  try {
    const attorneysController = new AttorneysController();
    const response = await attorneysController.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('attorneys', {
  authLevel: 'anonymous',
  handler,
  methods: ['GET'],
  route: 'attorneys/{id:int?}',
});
