import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAssignmentUseCase } from '../../use-cases/case.assignment';
import { AssignmentError } from '../../use-cases/assignment.exception';
import { CaseAssignmentRole } from '../../adapters/types/case.assignment.role';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsError } from '../../common-errors/cams-error';
import {
  AttorneyAssignmentResponseInterface,
  CaseAssignment,
} from '../../../../../common/src/cams/assignments';
import { CamsResponse } from '../controller-types';

const MODULE_NAME = 'ASSIGNMENT-CONTROLLER';
const INVALID_ROLE_MESSAGE =
  'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment.';
const VALID_CASEID_PATTERN = RegExp(/^[\dA-Z]{3}-\d{2}-\d{5}$/);
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 01-12345.';

type GetTrialAttorneyAssignmentsResponse = CamsResponse<Array<CaseAssignment>>;

export class CaseAssignmentController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.applicationContext = context;
  }

  public async getTrialAttorneyAssignments(
    caseId: string,
  ): Promise<GetTrialAttorneyAssignmentsResponse> {
    try {
      const assignmentUseCase = new CaseAssignmentUseCase(this.applicationContext);
      const assignments = await assignmentUseCase.findAssignmentsByCaseId(caseId);
      return {
        success: true,
        body: assignments,
      };
    } catch (exception) {
      this.applicationContext.logger.error(MODULE_NAME, exception.message);
      if (exception instanceof CamsError) {
        throw exception;
      }
      throw new UnknownError(MODULE_NAME, { originalError: exception });
    }
  }

  public async createTrialAttorneyAssignments(params: {
    caseId: string;
    listOfAttorneyNames: string[];
    role: string;
  }): Promise<AttorneyAssignmentResponseInterface> {
    this.validateRequestParameters(params);
    try {
      const assignmentUseCase = new CaseAssignmentUseCase(this.applicationContext);
      const response = await assignmentUseCase.createTrialAttorneyAssignments(
        this.applicationContext,
        params.caseId,
        params.listOfAttorneyNames,
        params.role,
      );
      return response;
    } catch (exception) {
      this.applicationContext.logger.error(MODULE_NAME, exception.message);
      if (exception instanceof CamsError) {
        throw exception;
      }
      throw new UnknownError(MODULE_NAME, { originalError: exception });
    }
  }

  private validateRequestParameters(params: {
    caseId: string;
    listOfAttorneyNames: string[];
    role: string;
  }) {
    const badParams = [];
    let errors = false;
    let message = '';
    if (!params.caseId) {
      badParams.push('caseId');
      errors = true;
    } else if (!params.caseId.match(VALID_CASEID_PATTERN)) {
      message += INVALID_CASEID_MESSAGE;
      errors = true;
    }
    if (!params.role) {
      badParams.push('role');
      errors = true;
    }
    if (!(params.role in CaseAssignmentRole)) {
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
}
