import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { CasesController } from '../../../lib/controllers/cases/cases.controller';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

dotenv.config();

const MODULE_NAME = 'CASES-FUNCTION';

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator({
    invocationContext,
    request,
  });

  try {
    const casesController = new CasesController(context);

    const camsResponse = await casesController.handleRequest(context);
    return toAzureSuccess(camsResponse);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('cases', {
  authLevel: 'anonymous',
  handler,
  methods: ['GET', 'POST'],
  route: 'cases/{caseId?}',
});
