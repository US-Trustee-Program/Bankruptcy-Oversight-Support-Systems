import { ApplicationContext } from '../adapters/types/basic';
import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';

export interface ICaseAssignmentRepository {
  createAssignment(
    context: ApplicationContext,
    caseAssignment: CaseAttorneyAssignment,
  ): Promise<number>;

  getAssignment(assignmentId: number): Promise<CaseAttorneyAssignment>;
  findAssignment(caseAssignment: CaseAttorneyAssignment): Promise<CaseAttorneyAssignment>;
  getCount(): Promise<number>;
}
