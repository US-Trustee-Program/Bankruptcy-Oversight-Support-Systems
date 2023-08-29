import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import { CaseAssignmentRole } from '../lib/adapters/types/case.assignment.role';
import { TrialAttorneysAssignmentRequest } from '../lib/adapters/types/trial.attorneys.assignment.request';
import { AssignmentException } from '../lib/use-cases/assignment.exception';

const NAMESPACE = 'CASE-ASSIGNMENT-FUNCTION' as const;
const REQUIRED_CASE_ID_MESSAGE = 'Required parameter caseId is absent.';
const REQUIRED_ATTORNEY_LIST_MESSAGE = 'Required parameter attorneyList is absent.';
const REQUIRED_ROLE_MESSAGE = 'Required parameter - role of the attorney is absent.';
const INVALID_ROLE_MESSAGE =
  'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const caseId = request.body && request.body.caseId;
  const listOfAttorneyNames = request.body && request.body.attorneyList;
  const role = request.body && request.body.role;

  try {
    const assignmentRequest: TrialAttorneysAssignmentRequest = createAssignmentRequest(
      functionContext,
      caseId,
      listOfAttorneyNames,
      role,
    );
    const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
      functionContext,
    );

    const trialAttorneyAssignmentResponse =
      await caseAssignmentController.createTrialAttorneyAssignments(assignmentRequest);
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
};

function createAssignmentRequest(
  functionContext: Context,
  caseId: string,
  listOfAttorneyNames: string[],
  role: string,
): TrialAttorneysAssignmentRequest {
  validateRequestParameters(caseId, functionContext, listOfAttorneyNames, role);

  const professionalRole: CaseAssignmentRole = role as unknown as CaseAssignmentRole;
  return new TrialAttorneysAssignmentRequest(caseId, listOfAttorneyNames, professionalRole);
}

function validateRequestParameters(
  caseId: string,
  functionContext: Context,
  listOfAttorneyNames: string[],
  role: string,
) {
  validateCaseId(caseId, functionContext);
  validateAttorneys(listOfAttorneyNames, functionContext);
  validateRole(role, functionContext);
}

function validateCaseId(caseId: string, functionContext: Context) {
  if (!caseId) {
    log.error(applicationContextCreator(functionContext), NAMESPACE, REQUIRED_CASE_ID_MESSAGE);
    throw new AssignmentException(400, REQUIRED_CASE_ID_MESSAGE);
  }
}

function validateAttorneys(listOfAttorneyNames: string[], functionContext: Context) {
  if (listOfAttorneyNames.length < 1) {
    log.error(
      applicationContextCreator(functionContext),
      NAMESPACE,
      REQUIRED_ATTORNEY_LIST_MESSAGE,
    );
    throw new AssignmentException(400, REQUIRED_ATTORNEY_LIST_MESSAGE);
  }
}

function validateRole(role: string, functionContext: Context) {
  if (!role) {
    log.error(applicationContextCreator(functionContext), NAMESPACE, REQUIRED_ROLE_MESSAGE);
    throw new AssignmentException(400, REQUIRED_ROLE_MESSAGE);
  } else if (!(CaseAssignmentRole[role] === CaseAssignmentRole.TrialAttorney)) {
    log.error(applicationContextCreator(functionContext), NAMESPACE, INVALID_ROLE_MESSAGE);
    throw new AssignmentException(400, INVALID_ROLE_MESSAGE);
  }
}

export default httpTrigger;
