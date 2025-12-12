import {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterUseCase,
  StaffAssignmentFilterStore,
  UNASSIGNED_OPTION,
} from './staffAssignmentFilter.types';
import { ResponseBody } from '@common/api/response';
import { CamsUserReference } from '@common/cams/users';
import { UstpOfficeDetails } from '@common/cams/offices';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import { ComboOption } from '@/lib/components/combobox/ComboBox';

const staffAssignmentFilterUseCase = (
  store: StaffAssignmentFilterStore,
  controls: StaffAssignmentFilterControls,
): StaffAssignmentFilterUseCase => {
  const assigneesToComboOptions = (officeAssignees: CamsUserReference[]): ComboOption[] => {
    const comboOptions: ComboOption[] = [];
    officeAssignees.forEach((assignee) => {
      comboOptions.push({
        value: assignee.id,
        label: assignee.name,
      });
    });
    comboOptions.unshift(UNASSIGNED_OPTION);
    return comboOptions;
  };

  const fetchAssignees = async () => {
    const session = LocalStorage.getSession();
    if (session?.user.offices) {
      const { offices } = session.user;
      try {
        const assignees = await getOfficeAssignees(Api2.getOfficeAssignees, offices);
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

export default staffAssignmentFilterUseCase;
