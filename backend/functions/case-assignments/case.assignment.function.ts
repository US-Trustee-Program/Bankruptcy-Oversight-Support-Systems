import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CaseAssignmentController } from '../lib/controllers/case-assignment/case.assignment.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { ApplicationContext } from '../lib/adapters/types/basic';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { CamsUserReference } from '../../../common/src/cams/session';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION' as const;

initializeApplicationInsights();

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    functionContext,
    request,
  );
  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    if (request.method === 'POST') {
      const listOfAttorneyNames = request.body.attorneyList;
      const role = request.body.role;
      await handlePostMethod(applicationContext, request.body.caseId, listOfAttorneyNames, role);
    } else {
      await handleGetMethod(applicationContext, request.params['id']);
    }
    functionContext.res = applicationContext.res;
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    functionContext.res = httpError(error);
  }
};

async function handleGetMethod(applicationContext, caseId) {
  const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
    applicationContext,
  );

  const trialAttorneyAssignmentResponse =
    await caseAssignmentController.getTrialAttorneyAssignments(caseId);

  applicationContext.res = httpSuccess(trialAttorneyAssignmentResponse);
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

  applicationContext.res = httpSuccess(trialAttorneyAssignmentResponse);
}

export default httpTrigger;
