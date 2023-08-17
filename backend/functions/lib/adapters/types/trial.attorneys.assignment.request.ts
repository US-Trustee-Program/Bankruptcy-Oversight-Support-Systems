import { CaseAssignmentRole } from './case.assignment.role';

export class TrialAttorneysAssignmentRequest {
  caseId: string;
  caseTitle: string;
  listOfAttorneyIds: string[];
  role: CaseAssignmentRole;

  constructor(
    caseId: string,
    listOfAttorneyIds: string[],
    role: CaseAssignmentRole,
    caseTitle?: string,
  ) {
    this.caseId = caseId;
    this.listOfAttorneyIds = listOfAttorneyIds;
    this.role = role;
    this.caseTitle = caseTitle;
  }
}
