import * as dotenv from 'dotenv';
import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { CaseHistoryController } from '../lib/controllers/case-history/case-history.controller';
import { initializeApplicationInsights } from '../azure/app-insights';
import { azureToCamsHttpRequest, toAzureError, toAzureSuccess } from '../azure/functions';

const MODULE_NAME = 'CASE-HISTORY-FUNCTION' as const;

dotenv.config();

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);
  try {
    const applicationContext = await ContextCreator.applicationContextCreator(
      invocationContext,
      logger,
      request,
    );
    const camsRequest = await azureToCamsHttpRequest(request);
    const caseHistoryController = new CaseHistoryController(applicationContext);

    const responseBody = await caseHistoryController.getCaseHistory(
      applicationContext,
      camsRequest,
    );
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('case-history', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{id?}/history',
});
