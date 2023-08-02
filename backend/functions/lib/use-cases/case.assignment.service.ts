import { ICaseAssignmentRepository } from '../interfaces/ICaseAssignmentRepository';
import { getAssignmentRepository } from '../factory';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';
import { ApplicationContext } from '../adapters/types/basic';
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
    return await this._assignmentRepository.createAssignment(context, caseAssignment);
  }
}
