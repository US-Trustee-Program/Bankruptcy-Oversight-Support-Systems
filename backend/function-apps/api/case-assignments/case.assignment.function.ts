import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

import { CaseAssignmentController } from '../../../lib/controllers/case-assignment/case.assignment.controller';
import { initializeApplicationInsights } from '../../azure/app-insights';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { extraOutputs } from '../queue-outputs';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION';

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
    const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
      context,
    );
    return toAzureSuccess(await caseAssignmentController.handleRequest(context));
  } catch (error) {
    return toAzureError(context.logger, MODULE_NAME, error);
  }
}

app.http('case-assignments', {
  authLevel: 'anonymous',
  extraOutputs,
  handler,
  methods: ['GET', 'POST'],
  route: 'case-assignments/{id?}',
});
