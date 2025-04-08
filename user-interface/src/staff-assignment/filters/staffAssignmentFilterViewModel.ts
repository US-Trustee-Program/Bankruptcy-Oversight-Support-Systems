import { CamsUserReference } from '../../../../common/dist/cams/users';
import { ComboOption } from '../../lib/components/combobox/ComboBox';

interface StaffAssignmentFilterViewModel {
  officeAssignees: CamsUserReference[];
  officeAssigneesError: boolean;

  assigneesToComboOptions(officeAssignees: CamsUserReference[]): ComboOption[];
  handleFilterAssignee(assignees: ComboOption[]): void;
}

export type { StaffAssignmentFilterViewModel };
