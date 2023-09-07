import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import { CaseAssignmentRole } from '../lib/adapters/types/case.assignment.role';
import { AssignmentException } from '../lib/use-cases/assignment.exception';

const NAMESPACE = 'CASE-ASSIGNMENT-FUNCTION' as const;
const INVALID_ROLE_MESSAGE =
  'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment. ';
const CASEID_LENGTH = 8;

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const caseId = request.body && request.body.caseId;
  const listOfAttorneyNames = request.body && request.body.attorneyList;
  const role = request.body && request.body.role;

  if (request.method === 'POST') {
    validateRequestParameters(caseId, functionContext, listOfAttorneyNames, role);
    await handlePostMethod(functionContext, caseId, listOfAttorneyNames, role);
  } else if (request.method === 'GET') {
    await handleGetMethod();
  }
};

function validateRequestParameters(
  caseId: string,
  functionContext: Context,
  listOfAttorneyNames: string[],
  role: string,
) {
  const badParams = [];
  let errors = false;
  let message = '';
  if (!caseId || caseId.length != CASEID_LENGTH) {
    badParams.push('caseId');
    errors = true;
  }
  if (!listOfAttorneyNames || listOfAttorneyNames.length < 1) {
    badParams.push('attorneyList');
    errors = true;
  }
  if (!role) {
    badParams.push('role');
    errors = true;
  }
  if (!(role in CaseAssignmentRole)) {
    message = INVALID_ROLE_MESSAGE;
    errors = true;
  }
  if (errors) {
    message += `Required parameter(s) ${badParams.join(', ')} is/are absent.`;
    log.error(applicationContextCreator(functionContext), NAMESPACE, message);
    throw new AssignmentException(400, message);
  }
}

async function handlePostMethod(functionContext: Context, caseId, listOfAttorneyNames, role) {
  try {
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
    console.log(functionContext.res.body.toString());
  } catch (exception) {
    if (exception instanceof AssignmentException) {
      functionContext.res = httpError(functionContext, exception, exception.status);
    } else {
      functionContext.res = httpError(functionContext, exception, 500);
    }
    log.error(applicationContextCreator(functionContext), NAMESPACE, exception.message, exception);
  }
}

async function handleGetMethod() {
  // TODO: implement the get
}

export default httpTrigger;
