import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { CaseHistoryController } from '../../../lib/controllers/case-history/case-history.controller';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'CASE-HISTORY-FUNCTION';

dotenv.config();

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
    const caseHistoryController = new CaseHistoryController();
    const responseBody = await caseHistoryController.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('case-history', {
  authLevel: 'anonymous',
  handler,
  methods: ['GET'],
  route: 'cases/{id?}/history',
});
