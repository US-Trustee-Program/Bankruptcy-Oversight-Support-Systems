export interface CaseAssignment {
  id?: string;
  documentType: 'ASSIGNMENT';
  caseId: string;
  name: string;
  role: string;
  assignedOn: string;
  unassignedOn?: string;
}

export interface CaseAssignmentHistory {
  id?: string;
  documentType: 'ASSIGNMENT_HISTORY';
  caseId: string;
  occurredAtTimestamp: string;
  previousAssignments: CaseAssignment[];
  newAssignments: CaseAssignment[];
}

export interface AttorneyAssignmentResponseInterface {
  success: boolean;
  message: string;
  count: number;
  body: string[] | CaseAssignment[];
}
