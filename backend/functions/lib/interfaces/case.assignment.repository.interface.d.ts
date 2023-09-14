import { CaseAttorneyAssignment } from '../adapters/types/case.attorney.assignment';

export interface CaseAssignmentRepositoryInterface {
  createAssignment(caseAssignment: CaseAttorneyAssignment): Promise<string>;
  getAllAssignments(): Promise<CaseAttorneyAssignment[]>;
  getAssignment(assignmentId: string): Promise<CaseAttorneyAssignment>;
  findAssignmentsByCaseId(caseId: string): Promise<CaseAttorneyAssignment[]>;
  findAssignmentsByAssigneeName(attorney: string): Promise<CaseAttorneyAssignment[]>;
}
