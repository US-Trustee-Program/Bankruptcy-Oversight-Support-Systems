import {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterHook,
} from './staffAssignmentFilter.types';
import { CamsUserReference } from '@common/cams/users';
import { useCallback, useEffect, useState } from 'react';
import { StaffAssignmentUseCase } from './staffAssignmentFilterUseCase';

export function useStaffAssignmentFilter(
  controls: StaffAssignmentFilterControls,
): StaffAssignmentFilterHook {
  const [officeAssignees, setOfficeAssignees] = useState<CamsUserReference[]>([]);
  const [officeAssigneesError, setOfficeAssigneesError] = useState<boolean>(false);

  const fetchAssignees = useCallback(async () => {
    const result = await StaffAssignmentUseCase.fetchAssignees();
    if (result.success && result.assignees) {
      setOfficeAssignees(result.assignees);
      setOfficeAssigneesError(false);
    } else {
      setOfficeAssigneesError(true);
    }
  }, []);

  const focusOnAssigneesFilter = () => {
    controls.assigneesFilterRef.current?.focusInput();
  };

  const assigneesToComboOptions = StaffAssignmentUseCase.assigneesToComboOptions;

  useEffect(() => {
    // This is a false positive -- fetchAssignees sets state asynchronously
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssignees();
  }, [fetchAssignees]);

  return {
    store: {
      officeAssignees,
      officeAssigneesError,
    },
    useCase: {
      fetchAssignees,
      focusOnAssigneesFilter,
      assigneesToComboOptions,
    },
  };
}
