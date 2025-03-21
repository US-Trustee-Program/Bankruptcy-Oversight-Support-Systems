import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { initializeApplicationInsights } from '../../azure/app-insights';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { CaseNotesController } from '../../../lib/controllers/case-notes/case.notes.controller';
import { UnauthorizedError } from '../../../lib/common-errors/unauthorized-error';
import { CaseNoteInput } from '../../../../common/src/cams/cases';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION';

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.applicationContextCreator<CaseNoteInput>({
    invocationContext,
    request,
  });

  try {
    const caseNotesController = new CaseNotesController(context);

    if (context.featureFlags['case-notes-enabled'] === false) {
      throw new UnauthorizedError(MODULE_NAME);
    }

    const controllerResponse = await caseNotesController.handleRequest(context);
    return toAzureSuccess(controllerResponse);
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('case-notes', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId}/notes/{noteId?}/{userId?}',
});
