import { CaseAssignmentRepositoryInterface } from '../interfaces/case.assignment.repository.interface';
import { getAssignmentRepository } from '../factory';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { ApplicationContext } from '../adapters/types/basic';
import { TrialAttorneyAssignmentResponse } from '../adapters/types/trial.attorney.assignment.response';
import log from '../adapters/services/logger.service';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';

const NAMESPACE = 'CASE-ASSIGNMENT';
export class CaseAssignment {
  private _assignmentRepository: CaseAssignmentRepositoryInterface;

  constructor(assignmentRepository?: CaseAssignmentRepositoryInterface) {
    if (!assignmentRepository) {
      this._assignmentRepository = getAssignmentRepository();
    } else {
      this._assignmentRepository = assignmentRepository;
    }
  }

  async createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<number> {
    try {
      return await this._assignmentRepository.createAssignment(context, caseAssignment);
    } catch (exception) {
      //Log the exception and handle depending.
      log.error(applicationContextCreator(context), NAMESPACE, exception.message);
      throw exception;
    }
  }

  async createTrialAttorneyAssignments(
    context: ApplicationContext,
    listOfAssignments: CaseAttorneyAssignment[],
  ): Promise<TrialAttorneyAssignmentResponse> {
    const listOfAssignmentIdsCreated: number[] = [];
    for (const assignment of listOfAssignments) {
      const assignmentId = await this.createAssignment(context, assignment);
      if (!listOfAssignmentIdsCreated.includes(assignmentId))
        listOfAssignmentIdsCreated.push(assignmentId);
    }

    const response = new TrialAttorneyAssignmentResponse();
    response.assignmentIdList = listOfAssignmentIdsCreated;
    response.success = true;
    response.message = 'Trial attorney assignments created.';
    response.resultCount = listOfAssignmentIdsCreated.length;

    return response;
  }
}
