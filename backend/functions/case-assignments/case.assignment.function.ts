import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { CaseAssignmentController } from '../lib/controllers/case-assignment/case.assignment.controller';
import { ApplicationContext } from '../lib/adapters/types/basic';
import ContextCreator from '../azure/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { CamsUserReference } from '../../../common/src/cams/users';
import { toAzureError, toAzureSuccess } from '../azure/functions';
import { CamsRole } from '../../../common/src/cams/roles';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION' as const;

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);
    let assignmentResponse: HttpResponseInit;
    if (request.method === 'POST') {
      //We should be doing this in the controller
      const listOfAttorneyNames = applicationContext.request.body['attorneyList'];
      const role = applicationContext.request.body['role'];
      const caseId = applicationContext.request.body['caseId'];
      assignmentResponse = await handlePostMethod(
        applicationContext,
        caseId,
        listOfAttorneyNames,
        role,
      );
    } else {
      assignmentResponse = await handleGetMethod(applicationContext, request.params['id']);
    }
    return assignmentResponse;
  } catch (error) {
    return toAzureError(applicationContext, MODULE_NAME, error);
  }
}

async function handleGetMethod(applicationContext, caseId) {
  const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
    applicationContext,
  );

  const trialAttorneyAssignmentResponse =
    await caseAssignmentController.getTrialAttorneyAssignments(caseId);

  return toAzureSuccess(trialAttorneyAssignmentResponse);
}

async function handlePostMethod(
  applicationContext: ApplicationContext,
  caseId: string,
  listOfAttorneyNames: CamsUserReference[],
  role: CamsRole.TrialAttorney,
) {
  const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
    applicationContext,
  );

  await caseAssignmentController.createTrialAttorneyAssignments({
    caseId,
    listOfAttorneyNames,
    role,
  });

  return toAzureSuccess();
}

app.http('case-assignments', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'case-assignments/{id?}',
});
