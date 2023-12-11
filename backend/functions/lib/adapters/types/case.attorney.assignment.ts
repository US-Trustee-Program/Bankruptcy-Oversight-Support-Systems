import { CaseAssignmentRole } from './case.assignment.role';

export class CaseAttorneyAssignment {
  id: string;
  caseId: string;
  name: string;
  role: CaseAssignmentRole;
  unassigned?: true;
  unassignedOn?: string;
  createdOn?: string;

  constructor(
    caseId: string,
    name: string,
    role: string,
    unassigned?: true,
    unassignedOn?: string,
    createdOn?: string,
  ) {
    this.caseId = caseId;
    this.name = name;
    this.role = CaseAssignmentRole[role];
    if (unassigned) {
      this.unassigned = true;
      this.unassignedOn = unassignedOn;
    }
    if (createdOn) {
      this.createdOn = createdOn;
    }
  }
}
