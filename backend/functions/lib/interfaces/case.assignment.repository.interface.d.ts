import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';

export interface CaseAssignmentRepositoryInterface {
  createAssignment(caseAssignment: CaseAttorneyAssignment): Promise<string>;
  getAssignment(assignmentId: string): Promise<CaseAttorneyAssignment>;
  findAssignment(caseAssignment: CaseAttorneyAssignment): Promise<CaseAttorneyAssignment>;
  getCount(): Promise<number>;
  findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]>;
}
