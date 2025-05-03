import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { CaseDocketController } from '../../../lib/controllers/case-docket/case-docket.controller';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CASE-DOCKET-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator({
    invocationContext,
    request,
  });

  try {
    const caseDocketController = new CaseDocketController(context);
    context.session = await ContextCreator.getApplicationContextSession(context);

    const response = await caseDocketController.handleRequest(context);
    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('case-docket', {
  authLevel: 'anonymous',
  handler,
  methods: ['GET'],
  route: 'cases/{caseId?}/docket',
});
