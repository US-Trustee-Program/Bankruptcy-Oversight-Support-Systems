import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import { toCamsError } from '../lib/common-errors/utility';

const MODULE_NAME = 'CASE-ASSIGNMENT-FUNCTION' as const;

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const caseId = request.body && request.body.caseId;
  const listOfAttorneyNames = request.body && request.body.attorneyList;
  const role = request.body && request.body.role;

  try {
    await handlePostMethod(functionContext, caseId, listOfAttorneyNames, role);
  } catch (e) {
    const camsError = toCamsError(MODULE_NAME, e);
    log.camsError(applicationContextCreator(functionContext), camsError);
    functionContext.res = httpError(camsError);
  }
};

async function handlePostMethod(
  functionContext: Context,
  caseId: string,
  listOfAttorneyNames: string[],
  role,
) {
  const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
    functionContext,
  );

  const trialAttorneyAssignmentResponse =
    await caseAssignmentController.createTrialAttorneyAssignments({
      caseId,
      listOfAttorneyNames,
      role,
    });
  functionContext.res = httpSuccess(trialAttorneyAssignmentResponse);
}

export default httpTrigger;
