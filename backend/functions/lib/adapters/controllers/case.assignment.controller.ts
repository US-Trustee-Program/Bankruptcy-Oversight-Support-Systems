import { ApplicationContext } from '../types/basic';
import { Context } from '@azure/functions';
import { applicationContextCreator } from '../utils/application-context-creator';
import { CaseAssignmentRequest } from '../types/case.assignment.request';
import log from '../services/logger.service';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentService } from '../../use-cases/case.assignment.service';

const NAMESPACE = 'ASSIGNMENT-CONTROLLER';
export class CaseAssignmentController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: Context) {
    this.applicationContext = applicationContextCreator(context);
  }

  public async createCaseAssignment(assignmentRequest: CaseAssignmentRequest): Promise<number> {
    log.info(this.applicationContext, NAMESPACE, 'Creating the case assignment to an attorney');
    const assignment = new CaseAttorneyAssignment(
      assignmentRequest.caseId,
      assignmentRequest.professionalId,
      assignmentRequest.role,
    );

    const assignmentService = new CaseAssignmentService();
    return await assignmentService.createAssignment(this.applicationContext, assignment);
  }
}
