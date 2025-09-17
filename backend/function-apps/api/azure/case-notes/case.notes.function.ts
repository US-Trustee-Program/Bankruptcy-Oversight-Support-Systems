import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { CaseNoteInput } from '../../../../../common/src/cams/cases';
import { CaseNotesController } from '../../../../lib/controllers/case-notes/case.notes.controller';
import { initializeApplicationInsights } from '../../../azure/app-insights';
import ContextCreator from '../../../azure/application-context-creator';
import { toAzureSuccess, toAzureError } from '../../../azure/functions';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION';

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator<CaseNoteInput>({
      invocationContext,
      request,
      logger,
    });

    const caseNotesController = new CaseNotesController(context);

    const controllerResponse = await caseNotesController.handleRequest(context);
    return toAzureSuccess(controllerResponse);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('case-notes', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId}/notes/{noteId?}/{userId?}',
});
