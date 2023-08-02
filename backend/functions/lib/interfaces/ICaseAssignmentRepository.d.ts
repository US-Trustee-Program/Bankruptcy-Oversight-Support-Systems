import { ApplicationContext } from '../adapters/types/basic';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';

export interface ICaseAssignmentRepository {
  createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<number>;

  getAssignment(assignmentId: number): CaseAttorneyAssignment;
}
