import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { CaseAssociatedController } from '../../../lib/controllers/case-associated/case-associated.controller';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

dotenv.config();

const MODULE_NAME = 'CASE-ASSOCIATED-FUNCTION';

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
    const controller = new CaseAssociatedController();
    const response = await controller.handleRequest(context);

    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('case-associated', {
  authLevel: 'anonymous',
  handler,
  methods: ['GET'],
  route: 'cases/{caseId?}/associated',
});
