import { CamsUserReference } from './users';
import { CamsRole } from './roles';
import { Auditable } from './auditable';

export type CaseAssignment = Auditable & {
  id?: string;
  documentType: 'ASSIGNMENT';
  caseId: string;
  userId: string;
  name: string;
  role: string;
  assignedOn: string;
  unassignedOn?: string;
};

export type StaffAssignmentAction = {
  caseId: string;
  attorneyList: CamsUserReference[];
  role: typeof CamsRole.TrialAttorney;
};
