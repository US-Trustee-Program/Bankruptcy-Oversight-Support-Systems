import { ApplicationContext } from '../types/basic';
import { Context } from '@azure/functions';
import { applicationContextCreator } from '../utils/application-context-creator';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { CaseAssignment } from '../../use-cases/case.assignment';
import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { TrialAttorneyAssignmentResponse } from '../types/trial.attorney.assignment.response';
import { TrialAttorneysAssignmentRequest } from '../types/trial.attorneys.assignment.request';

//const NAMESPACE = 'ASSIGNMENT-CONTROLLER'; // Will need this when implementing telemetry
export class CaseAssignmentController {
  private readonly applicationContext: ApplicationContext;
  private readonly caseAssignmentRepository: CaseAssignmentRepositoryInterface;

  constructor(context: Context, assignmentRepository?: CaseAssignmentRepositoryInterface) {
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
    const assignmentService = new CaseAssignment(this.caseAssignmentRepository);
    return assignmentService.createTrialAttorneyAssignments(
      this.applicationContext,
      listOfAssignments,
    );
  }
}
