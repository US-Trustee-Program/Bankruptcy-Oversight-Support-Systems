import { StaffAssignmentFilterStore } from './staffAssignmentFilterStore';
import { useStaffAssignmentFilterStoreReact } from './staffAssignmentFilterStoreReact';
import { CamsUserReference } from '../../../../common/dist/cams/users';
import StaffAssignmentFilterView from './StaffAssignmentFilterView';
import staffAssignmentFilterUseCase from './staffAssignmentFilterUseCase';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { forwardRef, useEffect, useImperativeHandle } from 'react';

export interface StaffAssignmentFilterRef {
  refresh: () => void;
}

export type StaffAssignmentScreenFilter = {
  assignee: CamsUserReference;
};

export type StaffAssignmentFilterProps = {
  handleFilterAssignee(assignees: ComboOption[]): void;
};

const _StaffAssignmentFilter = (
  props: StaffAssignmentFilterProps,
  ref: React.Ref<StaffAssignmentFilterRef>,
) => {
  const store: StaffAssignmentFilterStore = useStaffAssignmentFilterStoreReact();
  const useCase = staffAssignmentFilterUseCase(store);

  useImperativeHandle(ref, () => {
    return {
      refresh: useCase.fetchAssignees,
    };
  });

  useEffect(() => {
    useCase.fetchAssignees();
  }, []);

  const viewModel = {
    officeAssignees: store.officeAssignees,
    officeAssigneesError: store.officeAssigneesError,
    handleFilterAssignee: props.handleFilterAssignee,
    assigneesToComboOptions: useCase.assigneesToComboOptions,
  };

  return <StaffAssignmentFilterView viewModel={viewModel}></StaffAssignmentFilterView>;
};

const StaffAssignmentFilter = forwardRef(_StaffAssignmentFilter);
export default StaffAssignmentFilter;
