import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { ResponseBody } from '@common/api/response';
import { UstpOfficeDetails } from '@common/cams/offices';
import { CamsUserReference } from '@common/cams/users';

export const UNASSIGNED_OPTION = {
  divider: true,
  label: '(unassigned)',
  value: 'UNASSIGNED',
};

interface StaffAssignmentFilterControls {
  assigneesFilterRef: React.RefObject<ComboBoxRef>;
}

type StaffAssignmentFilterProps = {
  handleFilterAssignee(assignees: ComboOption[]): void;
};

interface StaffAssignmentFilterRef {
  focus: () => void;
  refresh: () => void;
}

interface StaffAssignmentFilterStore {
  filterAssigneeCallback: ((assignees: ComboOption[]) => void) | null;
  focusOnRender: boolean;
  officeAssignees: CamsUserReference[];
  officeAssigneesError: boolean;
  setFilterAssigneeCallback(val: ((assignees: ComboOption[]) => void) | null): void;
  setFocusOnRender(val: boolean): void;
  setOfficeAssignees(val: CamsUserReference[]): void;
  setOfficeAssigneesError(val: boolean): void;
}

interface StaffAssignmentFilterUseCase {
  assigneesToComboOptions(officeAssignees: CamsUserReference[]): ComboOption[];
  fetchAssignees(): void;
  focusOnAssigneesFilter(): void;
  getOfficeAssignees(
    apiFunction: (office: string) => Promise<ResponseBody<CamsUserReference[]>>,
    offices: UstpOfficeDetails[],
  ): Promise<CamsUserReference[]>;
  handleFilterAssignee(val: ComboOption[]): void;
}

interface StaffAssignmentFilterViewModel {
  assigneesFilterRef: React.RefObject<ComboBoxRef>;
  assigneesToComboOptions(officeAssignees: CamsUserReference[]): ComboOption[];
  handleFilterAssignee(assignees: ComboOption[]): void;

  officeAssignees: CamsUserReference[];
  officeAssigneesError: boolean;
}

type StaffAssignmentFilterViewProps = {
  viewModel: StaffAssignmentFilterViewModel;
};

type StaffAssignmentScreenFilter = {
  assignee?: CamsUserReference;
  includeOnlyUnassigned?: boolean;
};

export type {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterProps,
  StaffAssignmentFilterRef,
  StaffAssignmentFilterStore,
  StaffAssignmentFilterUseCase,
  StaffAssignmentFilterViewModel,
  StaffAssignmentFilterViewProps,
  StaffAssignmentScreenFilter,
};
