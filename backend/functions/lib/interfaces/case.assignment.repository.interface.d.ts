import { CaseAssignment, CaseAssignmentHistory } from '../adapters/types/case.assignment';

export interface CaseAssignmentRepositoryInterface {
  createAssignment(caseAssignment: CaseAssignment): Promise<string>;
  updateAssignment(caseAssignment: CaseAssignment): Promise<string>;
  getAssignment(assignmentId: string): Promise<CaseAssignment>;
  getAssignmentHistory(caseId: string): Promise<CaseAssignmentHistory[]>;
  findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]>;
  findAssignmentsByAssigneeName(attorney: string): Promise<CaseAssignment[]>;
  createAssignmentHistory(history: CaseAssignmentHistory): Promise<string>;
}
