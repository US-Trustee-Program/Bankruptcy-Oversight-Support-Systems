import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CasesController } from '../../../lib/controllers/cases/cases.controller';
import ContextCreator from '../../azure/application-context-creator';
import { initializeApplicationInsights } from '../../azure/app-insights';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

dotenv.config();

const MODULE_NAME = 'CASES-FUNCTION';

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
    const casesController = new CasesController(context);

    const camsResponse = await casesController.handleRequest(context);
    return toAzureSuccess(camsResponse);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('cases', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId?}',
});
