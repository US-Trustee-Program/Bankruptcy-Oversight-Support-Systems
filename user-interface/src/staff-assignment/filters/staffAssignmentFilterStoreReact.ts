import { CamsUserReference } from '@common/cams/users';
import { useState } from '../../lib/hooks/UseState';

export function useStaffAssignmentFilterStoreReact() {
  const [officeAssignees, setOfficeAssignees] = useState<CamsUserReference[]>([]);
  const [officeAssigneesError, setOfficeAssigneesError] = useState<boolean>(false);

  return {
    officeAssignees,
    setOfficeAssignees,
    officeAssigneesError,
    setOfficeAssigneesError,
  };
}

export default {
  useStaffAssignmentFilterStoreReact,
};
