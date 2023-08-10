import { CaseAssignmentRole } from './case.assignment.role';

export class CaseAttorneyAssignment {
  assignmentId: number;
  caseId: string;
  caseTitle: string;
  attorneyId: string;
  role: CaseAssignmentRole;

  constructor(
    caseId: string,
    professionalId: string,
    role: CaseAssignmentRole,
    caseTitle?: string,
  ) {
    this.caseId = caseId;
    this.caseTitle = caseTitle;
    this.attorneyId = professionalId;
    this.role = role;
  }
}
