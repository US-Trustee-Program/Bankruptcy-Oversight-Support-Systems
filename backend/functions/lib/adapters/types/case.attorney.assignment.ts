export interface CaseAttorneyAssignment {
  id?: string;
  caseId: string;
  name: string;
  role: string;
  assignedOn: string;
  unassignedOn?: string;
}
