import {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterHook,
} from './staffAssignmentFilter.types';
import { CamsUserReference } from '@common/cams/users';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
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

  const assigneesToComboOptions = useCallback(
    (officeAssigneesList: CamsUserReference[]): ComboOption[] => {
      return StaffAssignmentUseCase.assigneesToComboOptions(officeAssigneesList);
    },
    [],
  );

  useEffect(() => {
    StaffAssignmentUseCase.fetchAssignees().then((result) => {
      if (result.success && result.assignees) {
        setOfficeAssignees(result.assignees);
        setOfficeAssigneesError(false);
      } else {
        setOfficeAssigneesError(true);
      }
    });
  }, []);

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
