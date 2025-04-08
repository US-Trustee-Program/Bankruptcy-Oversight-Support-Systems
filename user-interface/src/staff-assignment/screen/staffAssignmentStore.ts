import { StaffAssignmentScreenFilter } from '../filters/StaffAssignmentFilter';

interface StaffAssignmentStore {
  staffAssignmentFilter: StaffAssignmentScreenFilter | undefined;
  setStaffAssignmentFilter(val: StaffAssignmentScreenFilter | undefined): void;
}

export type { StaffAssignmentStore };
