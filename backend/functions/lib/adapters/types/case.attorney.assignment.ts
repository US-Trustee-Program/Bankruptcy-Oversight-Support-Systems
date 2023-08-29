import { CaseAssignmentRole } from './case.assignment.role';

export class CaseAttorneyAssignment {
  id: string;
  caseId: string;
  caseTitle: string;
  attorneyName: string;
  role: CaseAssignmentRole;

  constructor(caseId: string, name: string, role: CaseAssignmentRole, caseTitle?: string) {
    this.caseId = caseId;
    this.caseTitle = caseTitle;
    this.attorneyName = name;
    this.role = role;
  }
}
