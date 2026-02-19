import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { CaseSummaryController } from '../../../lib/controllers/case-summary/case-summary.controller';

dotenv.config();

const MODULE_NAME = 'CASE-SUMMARY-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      logger,
      request,
    });

    const caseSummaryController = new CaseSummaryController(context);
    const response = await caseSummaryController.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('case-summary', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId?}/summary',
});
