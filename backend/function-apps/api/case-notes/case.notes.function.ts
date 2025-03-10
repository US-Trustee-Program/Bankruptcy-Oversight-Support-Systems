import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { initializeApplicationInsights } from '../../azure/app-insights';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { CaseNotesController } from '../../../lib/controllers/case-notes/case.notes.controller';
import { UnauthorizedError } from '../../../lib/common-errors/unauthorized-error';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION';

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
    const caseNotesController: CaseNotesController = new CaseNotesController(applicationContext);

    if (applicationContext.featureFlags['case-notes-enabled'] === false) {
      throw new UnauthorizedError(MODULE_NAME);
    }

    const controllerResponse = await caseNotesController.handleRequest(applicationContext);
    return toAzureSuccess(controllerResponse);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('case-notes', {
  methods: ['GET', 'POST', 'PATCH'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{id?}/notes',
});
