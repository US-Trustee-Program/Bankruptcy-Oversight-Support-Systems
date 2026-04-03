import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { CaseAssignmentController } from '../../../lib/controllers/case-assignment/case.assignment.controller';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { CASE_ASSIGNMENT_EVENT_QUEUE } from '../../../lib/storage-queues';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION';

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

// Conditionally add queue output binding - disabled in E2E tests where queue extension may not be available
// Only add queue binding if connection is configured (not in E2E mode)
app.http('case-assignments', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'case-assignments/{id?}',
  ...(process.env.AzureWebJobsDataflowsStorage
    ? { extraOutputs: [CASE_ASSIGNMENT_EVENT_QUEUE] }
    : {}),
});
