import { CamsUserReference } from './users';
import { CamsRole } from './roles';

export type CaseAssignment = {
  id?: string;
  documentType: 'ASSIGNMENT';
  caseId: string;
  userId: string;
  name: string;
  role: string;
  assignedOn: string;
  unassignedOn?: string;
  changedBy: CamsUserReference;
};

export type StaffAssignmentAction = {
  caseId: string;
  attorneyList: CamsUserReference[];
  role: CamsRole.TrialAttorney;
};
