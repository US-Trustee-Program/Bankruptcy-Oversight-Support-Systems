import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { CaseSummaryController } from '../lib/controllers/case-summary/case-summary.controller';
import { initializeApplicationInsights } from '../azure/app-insights';
import { toAzureError, toAzureSuccess } from '../azure/functions';

dotenv.config();

const MODULE_NAME = 'CASE-SUMMARY-FUNCTION' as const;

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const caseSummaryController = new CaseSummaryController(applicationContext);
  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const response = await caseSummaryController.getCaseSummary(applicationContext, {
      caseId: request.params.caseId,
    });
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(applicationContext, MODULE_NAME, error);
  }
}

app.http('case-summary', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId?}/summary',
});
