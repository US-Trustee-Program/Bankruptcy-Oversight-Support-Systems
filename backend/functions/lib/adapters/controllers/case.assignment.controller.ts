import { ApplicationContext } from '../types/basic';
import { Context } from '@azure/functions';
import { applicationContextCreator } from '../utils/application-context-creator';
import { CaseAssignmentRequest } from '../types/case.assignment.request';
import log from '../services/logger.service';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentService } from '../../use-cases/case.assignment.service';
import { ICaseAssignmentRepository } from '../../interfaces/ICaseAssignmentRepository';

const NAMESPACE = 'ASSIGNMENT-CONTROLLER';
export class CaseAssignmentController {
  private readonly applicationContext: ApplicationContext;
  private readonly caseAssignmentRepository: ICaseAssignmentRepository;

  constructor(context: Context, assignmentRepository?: ICaseAssignmentRepository) {
    this.applicationContext = applicationContextCreator(context);
    this.caseAssignmentRepository = assignmentRepository;
  }

  public async createCaseAssignment(assignmentRequest: CaseAssignmentRequest): Promise<number> {
    log.info(this.applicationContext, NAMESPACE, 'Creating the case assignment to a professional');
    log.info(this.applicationContext, NAMESPACE, `caseId: ${assignmentRequest.caseId}`);
    log.info(
      this.applicationContext,
      NAMESPACE,
      `professionalId: ${assignmentRequest.professionalId}`,
    );
    log.info(this.applicationContext, NAMESPACE, `role: ${assignmentRequest.role}`);
    const assignment = new CaseAttorneyAssignment(
      assignmentRequest.caseId,
      assignmentRequest.professionalId,
      assignmentRequest.role,
    );

    const assignmentService = new CaseAssignmentService(this.caseAssignmentRepository);
    const assignmentId = await assignmentService.createAssignment(
      this.applicationContext,
      assignment,
    );
    log.info(this.applicationContext, NAMESPACE, `assignmentId: ${assignment}`);
    return assignmentId;
  }
}
