import { app, InvocationContext, HttpRequest, HttpResponseInit } from '@azure/functions';
import { CaseAssignmentController } from '../lib/controllers/case-assignment/case.assignment.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { ApplicationContext } from '../lib/adapters/types/basic';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { CamsUserReference } from '../../../common/src/cams/users';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION' as const;

initializeApplicationInsights();

export async function handler(
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
      const requestBody = await request.json();
      const listOfAttorneyNames = requestBody['attorneyList'];
      const role = requestBody['role'];
      const caseId = requestBody['caseId'];
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
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    return httpError(error);
  }
}

async function handleGetMethod(applicationContext, caseId) {
  const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
    applicationContext,
  );

  const trialAttorneyAssignmentResponse =
    await caseAssignmentController.getTrialAttorneyAssignments(caseId);

  return httpSuccess(trialAttorneyAssignmentResponse);
}

async function handlePostMethod(
  applicationContext: ApplicationContext,
  caseId: string,
  listOfAttorneyNames: CamsUserReference[],
  role,
) {
  const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
    applicationContext,
  );

  const trialAttorneyAssignmentResponse =
    await caseAssignmentController.createTrialAttorneyAssignments({
      caseId,
      listOfAttorneyNames,
      role,
    });

  return httpSuccess(trialAttorneyAssignmentResponse);
}

app.http('handler', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'case-assignments/{id?}',
});

export default handler;
