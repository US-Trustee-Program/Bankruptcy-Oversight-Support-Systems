import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import { AssignmentError } from '../lib/use-cases/assignment.exception';

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
    if (e instanceof AssignmentError) {
      functionContext.res = httpError(functionContext, e, e.status);
    } else {
      functionContext.res = httpError(functionContext, e, 500);
    }
    log.error(applicationContextCreator(functionContext), MODULE_NAME, e.message, e);
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
  functionContext.res = httpSuccess(functionContext, trialAttorneyAssignmentResponse);
}

export default httpTrigger;
