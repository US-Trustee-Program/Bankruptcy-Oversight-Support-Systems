import { ICaseAssignmentRepository } from '../../interfaces/ICaseAssignmentRepository';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';

export class CaseAssignmentLocalRepository implements ICaseAssignmentRepository {
  private caseAttorneyAssignments: CaseAttorneyAssignment[] = [];
  private _nextUnusedId = 1;

  public async createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<number> {
    return this.addAssignment(caseAssignment);
  }

  public addAssignment(caseAssignment: CaseAttorneyAssignment): number {
    const assignmentId = this._nextUnusedId;
    caseAssignment._assignmentId = assignmentId;
    this.caseAttorneyAssignments.push(caseAssignment);
    ++this._nextUnusedId;
    return assignmentId;
  }
}
