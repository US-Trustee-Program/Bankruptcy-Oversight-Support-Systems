import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { TrusteeNotesController } from '../../../lib/controllers/trustee-notes/trustee-notes.controller';
import { TrusteeNoteInput } from '@common/cams/trustee-notes';

const MODULE_NAME = 'TRUSTEE-NOTES-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator<TrusteeNoteInput>({
      invocationContext,
      request,
      logger,
    });

    const trusteeNotesController = new TrusteeNotesController(context);

    const controllerResponse = await trusteeNotesController.handleRequest(context);
    return toAzureSuccess(controllerResponse);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trustee-notes', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler,
  route: 'trustees/{trusteeId}/notes/{noteId?}',
});
