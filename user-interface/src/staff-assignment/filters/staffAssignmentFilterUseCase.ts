import { CamsUserReference } from '@common/cams/users';
import { UstpOfficeDetails } from '@common/cams/offices';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { UNASSIGNED_OPTION } from './staffAssignmentFilter.types';
import LocalStorage from '@/lib/utils/local-storage';
import Api2 from '@/lib/models/api2';

const getOfficeAssignees = async (offices: UstpOfficeDetails[]): Promise<CamsUserReference[]> => {
  const assigneeMap: Map<string, CamsUserReference> = new Map();

  for (const office of offices) {
    const assignees = await Api2.getOfficeAssignees(office.officeCode);
    assignees.data.forEach((assignee) => {
      if (!assigneeMap.has(assignee.id)) {
        assigneeMap.set(assignee.id, assignee);
      }
    });
  }

  return Array.from(assigneeMap.values()).sort((a, b) => (a.name < b.name ? -1 : 1));
};

const fetchAssignees = async (): Promise<{
  success: boolean;
  assignees?: CamsUserReference[];
}> => {
  const session = LocalStorage.getSession();
  if (!session?.user.offices) {
    return { success: false };
  }

  try {
    const assignees = await getOfficeAssignees(session.user.offices);
    return { success: true, assignees };
  } catch (_e) {
    return { success: false };
  }
};

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

export const StaffAssignmentUseCase = {
  getOfficeAssignees,
  fetchAssignees,
  assigneesToComboOptions,
};
