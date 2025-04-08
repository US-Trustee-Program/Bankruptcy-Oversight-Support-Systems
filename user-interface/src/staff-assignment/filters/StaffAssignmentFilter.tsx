import { Store, ViewModel } from './staffAssignmentFilter.types';
import { CamsUserReference } from '../../../../common/dist/cams/users';
import StaffAssignmentFilterView from './StaffAssignmentFilterView';
import staffAssignmentFilterUseCase from './staffAssignmentFilterUseCase';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';

const _StaffAssignmentFilter = (
  props: StaffAssignmentFilterProps,
  ref: React.Ref<StaffAssignmentFilterRef>,
) => {
  const store: Store = useStaffAssignmentFilterStoreReact();
  const useCase = staffAssignmentFilterUseCase(store);
  const globalAlert = useGlobalAlert();

  useImperativeHandle(ref, () => {
    return {
      refresh: useCase.fetchAssignees,
    };
  });

  useEffect(() => {
    if (store.officeAssigneesError) {
      globalAlert?.error('There was a problem getting the list of assignees.');
    }
  }, [store.officeAssigneesError]);

  useEffect(() => {
    useCase.fetchAssignees();
  }, []);

  const viewModel: ViewModel = {
    officeAssignees: store.officeAssignees,
    officeAssigneesError: store.officeAssigneesError,
    handleFilterAssignee: props.handleFilterAssignee,
    assigneesToComboOptions: useCase.assigneesToComboOptions,
  };

  return <StaffAssignmentFilterView viewModel={viewModel}></StaffAssignmentFilterView>;
};

const StaffAssignmentFilter = forwardRef(_StaffAssignmentFilter);
export default StaffAssignmentFilter;

export function useStaffAssignmentFilterStoreReact() {
  const [officeAssignees, setOfficeAssignees] = useState<CamsUserReference[]>([]);
  const [officeAssigneesError, setOfficeAssigneesError] = useState<boolean>(false);

  return {
    officeAssignees,
    setOfficeAssignees,
    officeAssigneesError,
    setOfficeAssigneesError,
  };
}

export interface StaffAssignmentFilterRef {
  refresh: () => void;
}

export type StaffAssignmentScreenFilter = {
  assignee: CamsUserReference;
};

export type StaffAssignmentFilterProps = {
  handleFilterAssignee(assignees: ComboOption[]): void;
};
