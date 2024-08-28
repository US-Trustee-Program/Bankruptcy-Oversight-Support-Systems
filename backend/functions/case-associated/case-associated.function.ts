import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { CaseAssociatedController } from '../lib/controllers/case-associated/case-associated.controller';

import * as dotenv from 'dotenv';
import { toAzureError, toAzureSuccess } from '../azure/functions';
dotenv.config();

const MODULE_NAME = 'CASE-ASSOCIATED-FUNCTION' as const;

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const controller = new CaseAssociatedController(applicationContext);

  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const response = await controller.getAssociatedCases(applicationContext, {
      caseId: applicationContext.request.params.caseId,
    });

    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(applicationContext, MODULE_NAME, error);
  }
}

app.http('case-associated', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{id?}/associated',
});
