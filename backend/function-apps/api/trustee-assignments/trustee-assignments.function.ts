import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { TrusteeAssignmentsController } from '../../../lib/controllers/trustee-assignments/trustee-assignments.controller';
import { toAzureError, toAzureSuccess } from '../../azure/functions';

const MODULE_NAME = 'TRUSTEE-ASSIGNMENTS-FUNCTION';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      logger,
      request,
    });

    context.session = await ContextCreator.getApplicationContextSession(context);
    const trusteeAssignmentsController = new TrusteeAssignmentsController(context);

    const responseBody = await trusteeAssignmentsController.handleRequest(context);
    return toAzureSuccess(responseBody);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('trusteeAssignments', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'trustees/{trusteeId}/oversight-assignments',
});
