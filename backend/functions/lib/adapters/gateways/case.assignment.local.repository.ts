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
    const assignment: CaseAttorneyAssignment = await this.findAssignment(caseAssignment);
    if (!assignment) {
      return this.addAssignment(caseAssignment);
    } else {
      return assignment.assignmentId;
    }
  }

  private addAssignment(caseAssignment: CaseAttorneyAssignment): number {
    const assignmentId = this._nextUnusedId;
    caseAssignment.assignmentId = assignmentId;
    this.caseAttorneyAssignments.push(caseAssignment);
    ++this._nextUnusedId;
    return assignmentId;
  }

  public async getAssignment(assignmentId: number): Promise<CaseAttorneyAssignment> {
    return this.caseAttorneyAssignments.find(
      (assignment) => assignment.assignmentId === assignmentId,
    );
  }

  public async findAssignment(
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<CaseAttorneyAssignment> {
    return this.caseAttorneyAssignments.find((assignment) => {
      return (
        assignment.caseId === caseAssignment.caseId &&
        assignment.professionalId === caseAssignment.professionalId &&
        assignment.role === caseAssignment.role
      );
    });
  }
  public async getCount(): Promise<number> {
    return this.caseAttorneyAssignments.length;
  }
}
