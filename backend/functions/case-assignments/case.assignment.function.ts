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
const VALID_CASEID_PATTERN = RegExp('^\\d{2}-\\d{5}$');
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 01-12345. ';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const caseId = request.body && request.body.caseId;
  const listOfAttorneyNames = request.body && request.body.attorneyList;
  const role = request.body && request.body.role;

  try {
    validateRequestParameters(caseId, functionContext, listOfAttorneyNames, role);
    await handlePostMethod(functionContext, caseId, listOfAttorneyNames, role);
  } catch (e) {
    if (e instanceof AssignmentException) {
      functionContext.res = httpError(functionContext, e, e.status);
    } else {
      functionContext.res = httpError(functionContext, e, 500);
    }
    log.error(applicationContextCreator(functionContext), NAMESPACE, e.message, e);
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
  if (!caseId) {
    badParams.push('caseId');
    errors = true;
  } else if (!caseId.match(VALID_CASEID_PATTERN)) {
    message += INVALID_CASEID_MESSAGE;
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
    message += INVALID_ROLE_MESSAGE;
    errors = true;
  }
  if (errors) {
    if (badParams.length > 0)
      message += `Required parameter(s) ${badParams.join(', ')} is/are absent.`;
    throw new AssignmentException(400, message.trim());
  }
}

async function handlePostMethod(functionContext: Context, caseId, listOfAttorneyNames, role) {
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
