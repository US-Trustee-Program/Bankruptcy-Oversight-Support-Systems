import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { CamsUserReference } from '@common/cams/users';

export const UNASSIGNED_OPTION = {
  value: 'UNASSIGNED',
  label: '(unassigned)',
  divider: true,
};

interface StaffAssignmentFilterControls {
  assigneesFilterRef: React.RefObject<ComboBoxRef | null>;
}

type StaffAssignmentFilterViewProps = {
  viewModel: StaffAssignmentFilterViewModel;
};

interface StaffAssignmentFilterViewModel {
  officeAssignees: CamsUserReference[];
  officeAssigneesError: boolean;
  assigneesFilterRef: React.RefObject<ComboBoxRef | null>;

  assigneesToComboOptions(officeAssignees: CamsUserReference[]): ComboOption[];
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

interface StaffAssignmentFilterStore {
  officeAssignees: CamsUserReference[];
  officeAssigneesError: boolean;
  focusOnRender: boolean;
  filterAssigneeCallback: ((assignees: ComboOption[]) => void) | null;
  setFilterAssigneeCallback: (val: ((assignees: ComboOption[]) => void) | null) => void;
}

interface StaffAssignmentFilterHook {
  store: StaffAssignmentFilterStore;
  useCase: {
    fetchAssignees: () => Promise<void>;
    focusOnAssigneesFilter: () => void;
    handleFilterAssignee: (assignees: ComboOption[]) => Promise<void>;
    assigneesToComboOptions: (officeAssignees: CamsUserReference[]) => ComboOption[];
  };
}

export type {
  StaffAssignmentFilterStore,
  StaffAssignmentFilterControls,
  StaffAssignmentFilterViewModel,
  StaffAssignmentFilterViewProps,
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
  StaffAssignmentFilterProps,
  StaffAssignmentFilterHook,
};
