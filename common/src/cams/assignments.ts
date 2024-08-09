import { CamsUserReference } from './users';

export type CaseAssignment = {
  id?: string;
  documentType: 'ASSIGNMENT';
  caseId: string;
  userId: string;
  name: string;
  role: string;
  assignedOn: string;
  unassignedOn?: string;
  assignmentChangedBy: CamsUserReference;
};

export type AttorneyAssignmentResponseInterface = {
  success: boolean;
  message: string;
  count: number;
  body: string[] | CaseAssignment[];
};
