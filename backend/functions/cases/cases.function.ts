import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CasesController } from '../lib/controllers/cases/cases.controller';
import ContextCreator from '../azure/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { toAzureError, toAzureSuccess } from '../azure/functions';

dotenv.config();

const MODULE_NAME = 'CASES-FUNCTION';

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);
  try {
    const applicationContext = await ContextCreator.applicationContextCreator(
      invocationContext,
      logger,
      request,
    );
    const casesController = new CasesController(applicationContext);

    if (applicationContext.request.method === 'GET' && applicationContext.request.params.caseId) {
      const response = await casesController.getCaseDetails({
        caseId: applicationContext.request.params.caseId,
      });
      return toAzureSuccess(response);
    } else {
      const response = await casesController.searchCases(applicationContext.request);
      return toAzureSuccess(response);
    }
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('cases', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId?}',
});
