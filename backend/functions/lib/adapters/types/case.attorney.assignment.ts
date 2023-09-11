import { CaseAssignmentRole } from './case.assignment.role';

export class CaseAttorneyAssignment {
  id: string;
  caseId: string;
  attorneyName: string;
  role: CaseAssignmentRole;

  constructor(caseId: string, name: string, role: CaseAssignmentRole) {
    this.caseId = caseId;
    this.attorneyName = name;
    this.role = role;
  }
}
