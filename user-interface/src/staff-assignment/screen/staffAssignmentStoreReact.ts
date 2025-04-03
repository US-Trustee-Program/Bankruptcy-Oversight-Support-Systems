import { useState } from 'react';
import { CamsUserReference } from '@common/cams/users';
import { StaffAssignmentScreenFilter } from './staffAssignmentControls';

export function useStaffAssignmentStoreReact() {
  const [officeAssignees, setOfficeAssignees] = useState<CamsUserReference[]>([]);
  const [officeAssigneesError, setOfficeAssigneesError] = useState<boolean>(false);
  const [staffAssignmentFilter, setStaffAssignmentFilter] = useState<
    StaffAssignmentScreenFilter | undefined
  >();

  return {
    officeAssignees,
    setOfficeAssignees,
    officeAssigneesError,
    setOfficeAssigneesError,
    staffAssignmentFilter,
    setStaffAssignmentFilter,
  };
}

export default {
  useStaffAssignmentStoreReact,
};
