import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { CaseDocketController } from '../lib/controllers/case-docket/case-docket.controller';
import { initializeApplicationInsights } from '../azure/app-insights';

dotenv.config();

initializeApplicationInsights();

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

    const responseBody = await caseDocketController.getCaseDocket(applicationContext, {
      caseId: request.params.caseId,
    });
    return httpSuccess(responseBody);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    return httpError(camsError);
  }
}

app.http('case-docket', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId?}/docket',
});
