import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { CamsUserReference } from '@common/cams/users';

interface Store {
  officeAssignees: CamsUserReference[];
  setOfficeAssignees(val: CamsUserReference[]): void;
  officeAssigneesError: boolean;
  setOfficeAssigneesError(val: boolean): void;
}

interface ViewModel {
  officeAssignees: CamsUserReference[];
  officeAssigneesError: boolean;

  assigneesToComboOptions(officeAssignees: CamsUserReference[]): ComboOption[];
  handleFilterAssignee(assignees: ComboOption[]): void;
}

export type { Store, ViewModel };
