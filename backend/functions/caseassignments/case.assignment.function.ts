import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CaseAssignmentController } from '../lib/adapters/controllers/case.assignment.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import { CaseAssignmentRequest } from '../lib/adapters/types/case.assignment.request';
import { CaseAssignmentRole } from '../lib/adapters/types/case.assignment.role';

const NAMESPACE = 'CASE-ASSIGNMENT-FUNCTION' as const;
const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  caseAssignmentRequest: HttpRequest,
): Promise<void> {
  let caseId: string = '';
  let professionalId: string = '';
  let role: string = '';

  if (caseAssignmentRequest.query.caseId) caseId = caseAssignmentRequest.query.caseId;
  else if (caseAssignmentRequest.body && caseAssignmentRequest.body.caseId)
    caseId = caseAssignmentRequest.body.caseId;
  if (caseAssignmentRequest.query.professionalId)
    professionalId = caseAssignmentRequest.query.professionalId;
  else if (caseAssignmentRequest.body && caseAssignmentRequest.body.professionalId)
    caseId = caseAssignmentRequest.body.professionalId;
  if (caseAssignmentRequest.query.role) role = caseAssignmentRequest.query.role;
  else if (caseAssignmentRequest.body && caseAssignmentRequest.body.role)
    caseId = caseAssignmentRequest.body.role;

  const assignmentRequest: CaseAssignmentRequest = new CaseAssignmentRequest(
    caseId,
    professionalId,
    role as unknown as CaseAssignmentRole,
  );

  const caseAssignmentController: CaseAssignmentController = new CaseAssignmentController(
    functionContext,
  );

  try {
    const newAssignmentId = await caseAssignmentController.createCaseAssignment(assignmentRequest);
    const responseBody = {
      message: 'A new assignment has been created successfully',
      data: { assignmentId: newAssignmentId },
    };
    functionContext.res = httpSuccess(functionContext, responseBody);
  } catch (exception) {
    log.error(applicationContextCreator(functionContext), NAMESPACE, exception.message, exception);
    functionContext.res = httpError(functionContext, exception, 400);
  }
};

export default httpTrigger;
