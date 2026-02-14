import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { CaseAssignmentController } from '../../../lib/controllers/case-assignment/case.assignment.controller';
import ContextCreator from '../../azure/application-context-creator';
import { initializeApplicationInsights } from '../../azure/app-insights';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { CASE_ASSIGNMENT_EVENT_QUEUE } from '../../../lib/storage-queues';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION';

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      request,
      logger,
    });

    const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
      context,
    );
    return toAzureSuccess(await caseAssignmentController.handleRequest(context));
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('case-assignments', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'case-assignments/{id?}',
  extraOutputs: [CASE_ASSIGNMENT_EVENT_QUEUE],
});
