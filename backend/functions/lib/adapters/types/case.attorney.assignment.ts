import { CaseAssignmentRole } from './case.assignment.role';

export class CaseAttorneyAssignment {
  id: string;
  caseId: string;
  name: string;
  role: CaseAssignmentRole;

  constructor(caseId: string, name: string, role: CaseAssignmentRole) {
    this.caseId = caseId;
    this.name = name;
    this.role = role;
  }
}
