import * as dotenv from 'dotenv';
import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { CaseHistoryController } from '../lib/controllers/case-history/case-history.controller';
import { initializeApplicationInsights } from '../azure/app-insights';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { httpRequestToCamsHttpRequest } from '../azure/functions';

const MODULE_NAME = 'CASE-HISTORY-FUNCTION' as const;

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
  const caseHistoryController = new CaseHistoryController(applicationContext);
  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const camsRequest = httpRequestToCamsHttpRequest(request);
    const responseBody = await caseHistoryController.getCaseHistory(
      applicationContext,
      camsRequest,
    );
    return httpSuccess(responseBody);
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    return httpError(error);
  }
}

app.http('handler', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler,
  route: 'case-history/{id?}',
});
