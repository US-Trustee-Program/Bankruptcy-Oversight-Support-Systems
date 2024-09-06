import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAssignmentUseCase } from '../../use-cases/case-assignment';
import { AssignmentError } from '../../use-cases/assignment.exception';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsError } from '../../common-errors/cams-error';
import { CaseAssignment } from '../../../../../common/src/cams/assignments';
import { CamsUserReference } from '../../../../../common/src/cams/users';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import HttpStatusCodes from '../../../../../common/src/api/http-status-codes';
import { CamsController } from '../controller';

const MODULE_NAME = 'ASSIGNMENT-CONTROLLER';
const INVALID_ROLE_MESSAGE =
  'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment.';
const VALID_CASEID_PATTERN = RegExp(/^[\dA-Z]{3}-\d{2}-\d{5}$/);
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 01-12345.';

export class CaseAssignmentController implements CamsController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.applicationContext = context;
  }
  handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit | CamsHttpResponseInit<CaseAssignment[]>> {
    if (context.request.method === 'POST') {
      this.validateRequestParameters(context.request.body['caseId'], context.request.body['role']);
      return this.createTrialAttorneyAssignments(context);
    } else {
      return this.getTrialAttorneyAssignments(context);
    }
  }

  private validateRequestParameters(caseId: string, role: string) {
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
    if (!role) {
      badParams.push('role');
      errors = true;
    }
    if (!(role in CamsRole)) {
      message += INVALID_ROLE_MESSAGE;
      errors = true;
    }
    if (errors) {
      if (badParams.length > 0) {
        if (message.length > 0) message += ' ';
        message += `Required parameter(s) ${badParams.join(', ')} is/are absent.`;
      }
      throw new AssignmentError(MODULE_NAME, { message });
    }
  }

  public async getTrialAttorneyAssignments(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CaseAssignment[]>> {
    try {
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      const assignments = await assignmentUseCase.findAssignmentsByCaseId(
        context.request.params['id'],
      );
      const success = httpSuccess({
        body: {
          data: assignments,
        },
      });
      return success;
    } catch (exception) {
      context.logger.error(MODULE_NAME, exception.message);
      if (exception instanceof CamsError) {
        throw exception;
      }
      throw new UnknownError(MODULE_NAME, { originalError: exception });
    }
  }

  public async createTrialAttorneyAssignments(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit> {
    try {
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      await assignmentUseCase.createTrialAttorneyAssignments(
        context,
        context.request.body['caseId'],
        context.request.body['attorneyList'] as CamsUserReference[],
        context.request.body['role'],
      );
      return httpSuccess({
        statusCode: HttpStatusCodes.CREATED,
      });
    } catch (exception) {
      context.logger.error(MODULE_NAME, exception.message);
      if (exception instanceof CamsError) {
        throw exception;
      }
      throw new UnknownError(MODULE_NAME, { originalError: exception });
    }
  }
}
