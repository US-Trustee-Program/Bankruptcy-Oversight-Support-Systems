import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { CaseSummaryController } from '../../../lib/controllers/case-summary/case-summary.controller';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

dotenv.config();

const MODULE_NAME = 'CASE-SUMMARY-FUNCTION';

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
    const caseSummaryController = new CaseSummaryController(context);
    const response = await caseSummaryController.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('case-summary', {
  authLevel: 'anonymous',
  handler,
  methods: ['GET'],
  route: 'cases/{caseId?}/summary',
});
