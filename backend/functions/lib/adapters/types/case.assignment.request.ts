import { CaseAssignmentRole } from './case.assignment.role';

export class CaseAssignmentRequest {
  private _caseId: string;
  private _caseTitle: string;
  private _dateFiled: string;
  private _professionalId: string;
  private _role: CaseAssignmentRole;

  constructor(
    caseId: string,
    professionalId: string,
    role: CaseAssignmentRole,
    caseTitle?: string,
    dateFiled?: string,
  ) {
    this._caseId = caseId;
    this._caseTitle = caseTitle;
    this._dateFiled = dateFiled;
    this._professionalId = professionalId;
    this._role = role;
  }
  get role(): CaseAssignmentRole {
    return this._role;
  }

  set role(value: CaseAssignmentRole) {
    this._role = value;
  }
  get professionalId(): string {
    return this._professionalId;
  }

  set professionalId(value: string) {
    this._professionalId = value;
  }
  get dateFiled(): string {
    return this._dateFiled;
  }

  set dateFiled(value: string) {
    this._dateFiled = value;
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
}
