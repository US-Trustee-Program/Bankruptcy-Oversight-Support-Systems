import { ComboOption } from '@/lib/components/combobox/ComboBox';
import useApi2 from '@/lib/hooks/UseApi2';
import LocalStorage from '@/lib/utils/local-storage';
import { ResponseBody } from '@common/api/response';
import { UstpOfficeDetails } from '@common/cams/offices';
import { CamsUserReference } from '@common/cams/users';

import {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterStore,
  StaffAssignmentFilterUseCase,
  UNASSIGNED_OPTION,
} from './staffAssignmentFilter.types';

const staffAssignmentFilterUseCase = (
  store: StaffAssignmentFilterStore,
  controls: StaffAssignmentFilterControls,
): StaffAssignmentFilterUseCase => {
  const assigneesToComboOptions = (officeAssignees: CamsUserReference[]): ComboOption[] => {
    const comboOptions: ComboOption[] = [];
    officeAssignees.forEach((assignee) => {
      comboOptions.push({
        label: assignee.name,
        value: assignee.id,
      });
    });
    comboOptions.unshift(UNASSIGNED_OPTION);
    return comboOptions;
  };

  const fetchAssignees = async () => {
    const api = useApi2();
    const session = LocalStorage.getSession();
    if (session?.user.offices) {
      const { offices } = session.user;
      try {
        const assignees = await getOfficeAssignees(api.getOfficeAssignees, offices);
        store.setOfficeAssignees(assignees);
        store.setOfficeAssigneesError(false);
      } catch (_e) {
        store.setOfficeAssigneesError(true);
      }
    }
  };

  const focusOnAssigneesFilter = () => {
    controls.assigneesFilterRef.current?.focusInput();
  };

  const getOfficeAssignees = async (
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
  };

  const handleFilterAssignee = async (assignees: ComboOption[]) => {
    store.setFocusOnRender(true);
    if (store.filterAssigneeCallback) {
      store.filterAssigneeCallback(assignees);
    }
  };

  return {
    assigneesToComboOptions,
    fetchAssignees,
    focusOnAssigneesFilter,
    getOfficeAssignees,
    handleFilterAssignee,
  };
};

export { staffAssignmentFilterUseCase };

export default staffAssignmentFilterUseCase;
