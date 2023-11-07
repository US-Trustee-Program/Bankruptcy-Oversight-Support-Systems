import { ApplicationContext } from '../types/basic';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignment } from '../../use-cases/case.assignment';
import { AttorneyAssignmentResponseInterface } from '../types/case.assignment';
import log from '../services/logger.service';
import { AssignmentError } from '../../use-cases/assignment.exception';
import { CaseAssignmentRole } from '../types/case.assignment.role';
import { UnknownError } from '../../common-errors/unknown-error';
import { CamsError } from '../../common-errors/cams-error';

const MODULE_NAME = 'ASSIGNMENT-CONTROLLER';
const INVALID_ROLE_MESSAGE =
  'Invalid role for the attorney. Requires role to be a TrialAttorney for case assignment.';
const VALID_CASEID_PATTERN = RegExp(/^\d{3}-\d{2}-\d{5}$/);
const INVALID_CASEID_MESSAGE = 'caseId must be formatted like 01-12345.';

export class CaseAssignmentController {
  private readonly context: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.context = context;
  }

  public async createTrialAttorneyAssignments(params: {
    caseId: string;
    listOfAttorneyNames: string[];
    role: string;
  }): Promise<AttorneyAssignmentResponseInterface> {
    this.validateRequestParameters(params);
    try {
      const listOfAssignments: CaseAttorneyAssignment[] = [];

      const attorneys = [...new Set(params.listOfAttorneyNames)];
      attorneys.forEach((attorney) => {
        const assignment: CaseAttorneyAssignment = new CaseAttorneyAssignment(
          params.caseId,
          attorney,
          params.role,
        );
        listOfAssignments.push(assignment);
      });
      const assignmentUseCase = new CaseAssignment(this.context);
      return assignmentUseCase.createTrialAttorneyAssignments(this.context, listOfAssignments);
    } catch (exception) {
      log.error(this.context, MODULE_NAME, exception.message);
      if (exception instanceof CamsError) {
        throw exception;
      }
      throw new UnknownError(exception.module || MODULE_NAME, { originalError: exception });
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
    if (!params.listOfAttorneyNames || params.listOfAttorneyNames.length < 1) {
      badParams.push('attorneyList');
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
