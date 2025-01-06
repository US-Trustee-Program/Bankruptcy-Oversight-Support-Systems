import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { initializeApplicationInsights } from '../../azure/app-insights';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { CaseNotesController } from '../../../lib/controllers/case-notes/case.notes.controller';

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
    const noteResponse = toAzureSuccess(
      await caseNotesController.handleRequest(applicationContext),
    );
    return noteResponse;
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('case-notes', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'case/{id?}/notes',
});
