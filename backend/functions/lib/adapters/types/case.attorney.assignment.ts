import { CaseAssignmentRole } from './case.assignment.role';

export class CaseAttorneyAssignment {
  id: string;
  caseId: string;
  name: string;
  role: CaseAssignmentRole;
  assignedOn: string;
  unassignedOn?: string;

  constructor(
    caseId: string,
    name: string,
    role: string,
    assignedOn: string,
    unassignedOn?: string,
  ) {
    this.caseId = caseId;
    this.name = name;
    this.role = CaseAssignmentRole[role];
    if (unassignedOn) {
      this.unassignedOn = unassignedOn;
    }
    if (assignedOn) {
      this.assignedOn = assignedOn;
    }
  }
}
