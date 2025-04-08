import { CamsUserReference } from '@common/cams/users';

interface StaffAssignmentFilterStore {
  officeAssignees: CamsUserReference[];
  setOfficeAssignees(val: CamsUserReference[]): void;
  officeAssigneesError: boolean;
  setOfficeAssigneesError(val: boolean): void;
}

export type { StaffAssignmentFilterStore };
