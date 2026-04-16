import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { ResponseBody } from '@common/api/response';
import { UstpOfficeDetails } from '@common/cams/offices';
import { CamsUserReference, Staff } from '@common/cams/users';

export const UNASSIGNED_OPTION = {
  value: 'UNASSIGNED',
  label: '(unassigned)',
  divider: true,
};

interface StaffAssignmentFilterStore {
  filterAssigneeCallback: ((assignees: ComboOption[]) => void) | null;
  setFilterAssigneeCallback(val: ((assignees: ComboOption[]) => void) | null): void;
  focusOnRender: boolean;
  setFocusOnRender(val: boolean): void;
  officeAssignees: Staff[];
  setOfficeAssignees(val: Staff[]): void;
  officeAssigneesError: boolean;
  setOfficeAssigneesError(val: boolean): void;
}

interface StaffAssignmentFilterControls {
  assigneesFilterRef: React.RefObject<ComboBoxRef | null>;
}

type StaffAssignmentFilterViewProps = {
  viewModel: StaffAssignmentFilterViewModel;
};

interface StaffAssignmentFilterViewModel {
  officeAssignees: Staff[];
  officeAssigneesError: boolean;
  assigneesFilterRef: React.RefObject<ComboBoxRef | null>;

  assigneesToComboOptions(officeAssignees: Staff[]): ComboOption[];
  handleFilterAssignee(assignees: ComboOption[]): void;
}

interface StaffAssignmentFilterRef {
  refresh: () => void;
  focus: () => void;
}

type StaffAssignmentScreenFilter = {
  assignee?: CamsUserReference;
  includeOnlyUnassigned?: boolean;
};

type StaffAssignmentFilterProps = {
  handleFilterAssignee(assignees: ComboOption[]): void;
};

interface StaffAssignmentFilterUseCase {
  assigneesToComboOptions(officeAssignees: Staff[]): ComboOption[];
  fetchAssignees(): void;
  focusOnAssigneesFilter(): void;
  getOfficeAssignees(
    apiFunction: (office: string) => Promise<ResponseBody<Staff[]>>,
    offices: UstpOfficeDetails[],
  ): Promise<Staff[]>;
  handleFilterAssignee(val: ComboOption[]): void;
}

export type {
  StaffAssignmentFilterStore,
  StaffAssignmentFilterControls,
  StaffAssignmentFilterViewModel,
  StaffAssignmentFilterViewProps,
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
  StaffAssignmentFilterProps,
  StaffAssignmentFilterUseCase,
};
