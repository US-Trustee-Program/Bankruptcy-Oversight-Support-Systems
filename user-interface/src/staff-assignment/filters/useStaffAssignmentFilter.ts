import {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterHook,
  UNASSIGNED_OPTION,
} from './staffAssignmentFilter.types';
import { ResponseBody } from '@common/api/response';
import { CamsUserReference } from '@common/cams/users';
import { UstpOfficeDetails } from '@common/cams/offices';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { useCallback, useEffect, useState } from 'react';

export function useStaffAssignmentFilter(
  controls: StaffAssignmentFilterControls,
): StaffAssignmentFilterHook {
  // Internal state (replaces store)
  const [officeAssignees, setOfficeAssignees] = useState<CamsUserReference[]>([]);
  const [officeAssigneesError, setOfficeAssigneesError] = useState<boolean>(false);
  const [filterAssigneeCallback, setFilterAssigneeCallback] = useState<
    ((assignees: ComboOption[]) => void) | null
  >(null);
  const [focusOnRender, setFocusOnRender] = useState<boolean>(false);

  const getOfficeAssignees = useCallback(
    async (
      apiFunction: (office: string) => Promise<ResponseBody<CamsUserReference[]>>,
      offices: UstpOfficeDetails[],
    ): Promise<CamsUserReference[]> => {
      const assigneeMap: Map<string, CamsUserReference> = new Map();
      for (const office of offices) {
        const assignees = await apiFunction(office.officeCode);
        assignees.data.forEach((assignee) => {
          if (!assigneeMap.has(assignee.id)) {
            assigneeMap.set(assignee.id, assignee);
          }
        });
      }
      return Array.from(assigneeMap.values()).sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    [],
  );

  const fetchAssignees = useCallback(async () => {
    const session = LocalStorage.getSession();
    if (session?.user.offices) {
      const { offices } = session.user;
      try {
        const assignees = await getOfficeAssignees(Api2.getOfficeAssignees, offices);
        setOfficeAssignees(assignees);
        setOfficeAssigneesError(false);
      } catch (_e) {
        setOfficeAssigneesError(true);
      }
    }
  }, [getOfficeAssignees]);

  const focusOnAssigneesFilter = () => {
    controls.assigneesFilterRef.current?.focusInput();
  };

  const handleFilterAssignee = useCallback(
    async (assignees: ComboOption[]) => {
      setFocusOnRender(true);
      if (filterAssigneeCallback) {
        filterAssigneeCallback(assignees);
      }
    },
    [filterAssigneeCallback],
  );

  const assigneesToComboOptions = useCallback(
    (officeAssigneesList: CamsUserReference[]): ComboOption[] => {
      const comboOptions: ComboOption[] = [];
      officeAssigneesList.forEach((assignee) => {
        comboOptions.push({
          value: assignee.id,
          label: assignee.name,
        });
      });
      comboOptions.unshift(UNASSIGNED_OPTION);
      return comboOptions;
    },
    [],
  );

  useEffect(() => {
    const session = LocalStorage.getSession();
    if (!session?.user.offices) return;

    const { offices } = session.user;

    const loadAssignees = async () => {
      try {
        const assignees = await getOfficeAssignees(Api2.getOfficeAssignees, offices);
        setOfficeAssignees(assignees);
        setOfficeAssigneesError(false);
      } catch (_e) {
        setOfficeAssigneesError(true);
      }
    };

    loadAssignees();
  }, [getOfficeAssignees]);

  useEffect(() => {
    if (focusOnRender) {
      controls.assigneesFilterRef.current?.focusInput();
    }
  }, [focusOnRender, controls.assigneesFilterRef]);

  return {
    store: {
      officeAssignees,
      officeAssigneesError,
      focusOnRender,
      filterAssigneeCallback,
      setFilterAssigneeCallback,
    },
    useCase: {
      fetchAssignees,
      focusOnAssigneesFilter,
      handleFilterAssignee,
      assigneesToComboOptions,
    },
  };
}
