import { useState } from 'react';
import { StaffAssignmentScreenFilter } from '../filters/StaffAssignmentFilter';

export function useStaffAssignmentStoreReact() {
  const [staffAssignmentFilter, setStaffAssignmentFilter] = useState<
    StaffAssignmentScreenFilter | undefined
  >();

  return {
    staffAssignmentFilter,
    setStaffAssignmentFilter,
  };
}

export default {
  useStaffAssignmentStoreReact,
};
