import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import { CaseAssignmentRequest } from '../lib/adapters/types/case.assignment.request';
import { CaseAssignmentRole } from '../lib/adapters/types/case.assignment.role';

const NAMESPACE = 'CASE-ASSIGNMENT-FUNCTION' as const;
const REQUIRED_CASE_ID_MESSAGE = 'Required parameter caseId is absent.';
const REQUIRED_PROFESSIONAL_ID_MESSAGE = 'Required parameter professionalId is absent.';
const REQUIRED_ROLE_MESSAGE = 'Required parameter role of the professional is absent.';
const INVALID_ROLE_MESSAGE =
  'Invalid role for the professional. Please pass in a valid professional role to assign';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const caseId = request.query.caseId || (request.body && request.body.caseId);
  const professionalId =
    request.query.professionalId || (request.body && request.body.professionalId);
  const role = request.query.role || (request.body && request.body.role);

  try {
    const assignmentRequest: CaseAssignmentRequest = createAssignmentRequest(
      functionContext,
      caseId,
      professionalId,
      role,
    );
    const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
      functionContext,
    );

    const newAssignmentId = await caseAssignmentController.createCaseAssignment(assignmentRequest);
    /*const responseBody = {
      message: 'A new assignment has been created successfully',
      data: { assignmentId: newAssignmentId },
    };*/
    functionContext.res = httpSuccess(functionContext, { assignmentId: newAssignmentId });
  } catch (exception) {
    log.error(applicationContextCreator(functionContext), NAMESPACE, exception.message, exception);
    functionContext.res = httpError(functionContext, exception, 400);
  }
};

function createAssignmentRequest(
  functionContext: Context,
  caseId: string,
  professionalId: string,
  role: string,
): CaseAssignmentRequest {
  if (!caseId) {
    log.error(applicationContextCreator(functionContext), NAMESPACE, REQUIRED_CASE_ID_MESSAGE);
    functionContext.res = httpError(functionContext, new Error(REQUIRED_CASE_ID_MESSAGE), 400);
  }
  if (!professionalId) {
    log.error(
      applicationContextCreator(functionContext),
      NAMESPACE,
      REQUIRED_PROFESSIONAL_ID_MESSAGE,
    );
    functionContext.res = httpError(
      functionContext,
      new Error(REQUIRED_PROFESSIONAL_ID_MESSAGE),
      400,
    );
  }
  if (!role) {
    log.error(applicationContextCreator(functionContext), NAMESPACE, REQUIRED_ROLE_MESSAGE);
    functionContext.res = httpError(functionContext, new Error(REQUIRED_ROLE_MESSAGE), 400);
  }

  let professionalRole: CaseAssignmentRole;
  if (role in CaseAssignmentRole) {
    professionalRole = role as unknown as CaseAssignmentRole;
    return new CaseAssignmentRequest(caseId, professionalId, professionalRole);
  } else {
    log.error(applicationContextCreator(functionContext), NAMESPACE, INVALID_ROLE_MESSAGE);
    functionContext.res = httpError(functionContext, new Error(INVALID_ROLE_MESSAGE), 400);
  }
}

export default httpTrigger;
