import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import log from '../lib/adapters/services/logger.service';
import { CamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION' as const;

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const caseId = request?.body.caseId;
  const listOfAttorneyNames = request?.body.attorneyList;
  const role = request?.body.role;

  const applicationContext = await applicationContextCreator(functionContext);
  try {
    await handlePostMethod(applicationContext, caseId, listOfAttorneyNames, role);
    functionContext.res = applicationContext.res;
  } catch (originalError) {
    let error = originalError;
    if (!(error instanceof CamsError)) {
      error = new UnknownError(MODULE_NAME, { originalError });
    }
    log.camsError(applicationContext, error);
    functionContext.res = httpError(error);
  }
};

async function handlePostMethod(
  applicationContext: ApplicationContext,
  caseId: string,
  listOfAttorneyNames: string[],
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
