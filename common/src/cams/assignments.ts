import { Auditable } from './auditable';
import { CamsRole } from './roles';
import { CamsUserReference } from './users';

export type CaseAssignment = Auditable & {
  assignedOn: string;
  caseId: string;
  documentType: 'ASSIGNMENT';
  id?: string;
  name: string;
  role: string;
  unassignedOn?: string;
  userId: string;
};

export type StaffAssignmentAction = {
  attorneyList: CamsUserReference[];
  caseId: string;
  role: CamsRole.TrialAttorney;
};
