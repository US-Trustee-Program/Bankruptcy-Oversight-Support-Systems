import { CamsUserReference } from '@common/cams/users';
import { StaffAssignmentScreenFilter } from './staffAssignmentControls';

interface StaffAssignmentStore {
  officeAssignees: CamsUserReference[];
  setOfficeAssignees(val: CamsUserReference[]): void;
  officeAssigneesError: boolean;
  setOfficeAssigneesError(val: boolean): void;
  staffAssignmentFilter: StaffAssignmentScreenFilter | undefined;
  setStaffAssignmentFilter(val: StaffAssignmentScreenFilter | undefined): void;
}

export type { StaffAssignmentStore };
