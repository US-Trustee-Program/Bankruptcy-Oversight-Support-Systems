import { CaseAssignment } from '../../../../common/src/cams/assignments';

export interface CaseAssignmentRepositoryInterface {
  createAssignment(caseAssignment: CaseAssignment): Promise<string>;
  updateAssignment(caseAssignment: CaseAssignment): Promise<string>;
  getAssignment(assignmentId: string): Promise<CaseAssignment>;
  findAssignmentsByCaseId(caseId: string): Promise<CaseAssignment[]>;
  findAssignmentsByAssigneeName(attorney: string): Promise<CaseAssignment[]>;
}
