import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import ContextCreator from '../azure/application-context-creator';
import { CaseDocketController } from '../lib/controllers/case-docket/case-docket.controller';
import { initializeApplicationInsights } from '../azure/app-insights';
import { toAzureError, toAzureSuccess } from '../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CASE-DOCKET-FUNCTION' as const;

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const caseDocketController = new CaseDocketController(applicationContext);
  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const responseBody = await caseDocketController.getCaseDocket(applicationContext);
    return toAzureSuccess(responseBody);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    return toAzureError(applicationContext, MODULE_NAME, camsError);
  }
}

app.http('case-docket', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId?}/docket',
});
