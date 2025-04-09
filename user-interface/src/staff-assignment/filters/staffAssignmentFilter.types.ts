import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ResponseBody } from '@common/api/response';
import { UstpOfficeDetails } from '@common/cams/offices';
import { CamsUserReference } from '@common/cams/users';

interface Store {
  officeAssignees: CamsUserReference[];
  setOfficeAssignees(val: CamsUserReference[]): void;
  officeAssigneesError: boolean;
  setOfficeAssigneesError(val: boolean): void;
}

type StaffAssignmentFilterViewProps = {
  viewModel: ViewModel;
};

interface ViewModel {
  officeAssignees: CamsUserReference[];
  officeAssigneesError: boolean;

  assigneesToComboOptions(officeAssignees: CamsUserReference[]): ComboOption[];
  handleFilterAssignee(assignees: ComboOption[]): void;
}

interface StaffAssignmentFilterRef {
  refresh: () => void;
}

type StaffAssignmentScreenFilter = {
  assignee: CamsUserReference;
};

type StaffAssignmentFilterProps = {
  handleFilterAssignee(assignees: ComboOption[]): void;
};

interface StaffAssignmentFilterUseCase {
  assigneesToComboOptions(officeAssignees: CamsUserReference[]): ComboOption[];
  fetchAssignees(): void;
  getOfficeAssignees(
    apiFunction: (office: string) => Promise<ResponseBody<CamsUserReference[]>>,
    offices: UstpOfficeDetails[],
  ): Promise<CamsUserReference[]>;
}

export type {
  Store,
  ViewModel,
  StaffAssignmentFilterViewProps,
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
  StaffAssignmentFilterProps,
  StaffAssignmentFilterUseCase,
};
