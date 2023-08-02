import { CaseAssignmentRole } from './case.assignment.role';

export class CaseAttorneyAssignment {
  _assignmentId: number;
  _caseId: string;
  _caseTitle: string;
  _professionalId: string;
  _role: CaseAssignmentRole;

  constructor(
    caseId: string,
    professionalId: string,
    role: CaseAssignmentRole,
    caseTitle?: string,
  ) {
    this._caseId = caseId;
    this._caseTitle = caseTitle;
    this._professionalId = professionalId;
    this._role = role;
  }
}
