import { ICaseAssignmentRepository } from '../interfaces/ICaseAssignmentRepository';
import { getAssignmentRepository } from '../factory';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { ApplicationContext } from '../adapters/types/basic';
import { TrialAttorneyAssignmentResponse } from '../adapters/types/trial.attorney.assignment.response';

export class CaseAssignmentService {
  private _assignmentRepository: ICaseAssignmentRepository;

  constructor(assignmentRepository?: ICaseAssignmentRepository) {
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
