import { CaseAssignmentRepositoryInterface } from '../../interfaces/case.assignment.repository.interface';
import { CaseAttorneyAssignment } from '../types/case.attorney.assignment';
import { ApplicationContext } from '../types/basic';
import log from '../services/logger.service';

const NAMESPACE = 'LOCAL-ASSIGNMENT-REPOSITORY';

export class CaseAssignmentLocalRepository implements CaseAssignmentRepositoryInterface {
  private caseAttorneyAssignments: CaseAttorneyAssignment[] = [];
  private nextUnusedId = 1;

  public async createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<string> {
    const assignment: CaseAttorneyAssignment = await this.findAssignment(caseAssignment);
    if (!assignment) {
      return this.addAssignment(context, caseAssignment);
    } else {
      return assignment.id;
    }
  }

  private addAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): string {
    const assignmentId = this.nextUnusedId;
    caseAssignment.id = assignmentId.toString();
    this.caseAttorneyAssignments.push(caseAssignment);
    log.info(context, NAMESPACE, caseAssignment.attorneyName);
    ++this.nextUnusedId;
    return assignmentId.toString();
  }

  public async getAssignment(assignmentId: string): Promise<CaseAttorneyAssignment> {
    return this.caseAttorneyAssignments.find((assignment) => assignment.id === assignmentId);
  }

  public async findAssignment(
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<CaseAttorneyAssignment> {
    return this.caseAttorneyAssignments.find((assignment) => {
      return (
        assignment.caseId === caseAssignment.caseId &&
        assignment.attorneyName === caseAssignment.attorneyName &&
        assignment.role === caseAssignment.role
      );
    });
  }
  public async getCount(): Promise<number> {
    return this.caseAttorneyAssignments.length;
  }

  public async findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]> {
    return this.caseAttorneyAssignments.filter((assignment) => assignment.caseId === caseId);
  }
}
