export interface CaseAssignment {
  id?: string;
  documentType: 'ASSIGNMENT';
  caseId: string;
  name: string;
  role: string;
  assignedOn: string;
  unassignedOn?: string;
}

export interface AttorneyAssignmentResponseInterface {
  success: boolean;
  message: string;
  count: number;
  body: string[] | CaseAssignment[];
}
