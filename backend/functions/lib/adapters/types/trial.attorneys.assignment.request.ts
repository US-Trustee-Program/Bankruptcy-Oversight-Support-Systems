import { CaseAssignmentRole } from './case.assignment.role';

export class TrialAttorneysAssignmentRequest {
  caseId: string;
  caseTitle: string;
  listOfAttorneyNames: string[];
  role: CaseAssignmentRole;

  constructor(
    caseId: string,
    listOfAttorneyNames: string[],
    role: CaseAssignmentRole,
    caseTitle?: string,
  ) {
    this.caseId = caseId;
    this.listOfAttorneyNames = listOfAttorneyNames;
    this.role = role;
    this.caseTitle = caseTitle;
  }
}
