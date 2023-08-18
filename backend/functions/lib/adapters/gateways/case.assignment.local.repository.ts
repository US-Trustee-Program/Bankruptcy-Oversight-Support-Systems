import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';

export class CaseAssignmentLocalRepository implements CaseAssignmentRepositoryInterface {
  private caseAttorneyAssignments: CaseAttorneyAssignment[] = [];
  private nextUnusedId = 1;

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
    const assignmentId = this.nextUnusedId;
    caseAssignment.assignmentId = assignmentId;
    this.caseAttorneyAssignments.push(caseAssignment);
    ++this.nextUnusedId;
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
        assignment.attorneyId === caseAssignment.attorneyId &&
        assignment.role === caseAssignment.role
      );
    });
  }
  public async getCount(): Promise<number> {
    return this.caseAttorneyAssignments.length;
  }

  public async findAssignmentByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    return this.caseAttorneyAssignments.filter((assignment) => assignment.caseId === caseId);
  }
}
