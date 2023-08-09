import { ApplicationContext } from '../types/basic';
import { Context } from '@azure/functions';
import { applicationContextCreator } from '../utils/application-context-creator';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignmentService } from '../../use-cases/case.assignment.service';
import { ICaseAssignmentRepository } from '../../interfaces/ICaseAssignmentRepository';
import { TrialAttorneyAssignmentResponse } from '../types/trial.attorney.assignment.response';
import { TrialAttorneysAssignmentRequest } from '../types/trial.attorneys.assignment.request';

//const NAMESPACE = 'ASSIGNMENT-CONTROLLER'; // Will need this when implementing telemetry
export class CaseAssignmentController {
  private readonly applicationContext: ApplicationContext;
  private readonly caseAssignmentRepository: ICaseAssignmentRepository;

  constructor(context: Context, assignmentRepository?: ICaseAssignmentRepository) {
    this.applicationContext = applicationContextCreator(context);
    this.caseAssignmentRepository = assignmentRepository;
  }

  public async createTrailAttorneyAssignments(
    assignmentRequest: TrialAttorneysAssignmentRequest,
  ): Promise<TrialAttorneyAssignmentResponse> {
    const listOfAssignments: CaseAttorneyAssignment[] = [];

    assignmentRequest.listOfAttorneyIds.forEach((attorney) => {
      const assignment: CaseAttorneyAssignment = new CaseAttorneyAssignment(
        assignmentRequest.caseId,
        attorney,
        assignmentRequest.role,
      );
      listOfAssignments.push(assignment);
    });
    const assignmentService = new CaseAssignmentService(this.caseAssignmentRepository);
    return assignmentService.createTrialAttorneyAssignments(
      this.applicationContext,
      listOfAssignments,
    );
  }
}
