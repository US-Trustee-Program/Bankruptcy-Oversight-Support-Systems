import { CaseAssignmentRole } from './case.assignment.role';

export class TrialAttorneysAssignmentRequest {
  private _caseId: string;
  private _caseTitle: string;
  private _listOfAttorneyIds: string[];
  private _role: CaseAssignmentRole;

  constructor(
    caseId: string,
    listOfAttorneyIds: string[],
    role: CaseAssignmentRole,
    caseTitle?: string,
  ) {
    this._caseId = caseId;
    this._listOfAttorneyIds = listOfAttorneyIds;
    this._role = role;
    this._caseTitle = caseTitle;
  }

  get role(): CaseAssignmentRole {
    return this._role;
  }

  set role(value: CaseAssignmentRole) {
    this._role = value;
  }
  get caseTitle(): string {
    return this._caseTitle;
  }

  set caseTitle(value: string) {
    this._caseTitle = value;
  }
  get caseId(): string {
    return this._caseId;
  }

  set caseId(value: string) {
    this._caseId = value;
  }

  get listOfAttorneyIds(): string[] {
    return this._listOfAttorneyIds;
  }

  set listOfAttorneyIds(value: string[]) {
    this._listOfAttorneyIds = value;
  }
}
