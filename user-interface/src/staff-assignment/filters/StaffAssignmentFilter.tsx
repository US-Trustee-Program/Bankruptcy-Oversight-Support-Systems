import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { CamsUserReference } from '../../../../common/dist/cams/users';
import {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterProps,
  StaffAssignmentFilterRef,
  StaffAssignmentFilterStore,
  StaffAssignmentFilterViewModel,
} from './staffAssignmentFilter.types';
import staffAssignmentFilterUseCase from './staffAssignmentFilterUseCase';
import StaffAssignmentFilterView from './StaffAssignmentFilterView';

const _StaffAssignmentFilter = (
  props: StaffAssignmentFilterProps,
  ref: React.Ref<StaffAssignmentFilterRef>,
) => {
  const store: StaffAssignmentFilterStore = useStaffAssignmentFilterStoreReact();
  const controls: StaffAssignmentFilterControls = useStaffAssignmentFilterControlsReact();
  const useCase = staffAssignmentFilterUseCase(store, controls);
  const globalAlert = useGlobalAlert();

  useImperativeHandle(ref, () => {
    return {
      focus: useCase.focusOnAssigneesFilter,
      refresh: useCase.fetchAssignees,
    };
  });

  useEffect(() => {
    if (store.officeAssigneesError) {
      globalAlert?.error('There was a problem getting the list of assignees.');
    }
  }, [store.officeAssigneesError]);

  useEffect(() => {
    if (store.focusOnRender) {
      useCase.focusOnAssigneesFilter();
    }
  }, [store.focusOnRender]);

  useEffect(() => {
    useCase.fetchAssignees();
    if (props.handleFilterAssignee) {
      store.setFilterAssigneeCallback(() => props.handleFilterAssignee);
    }
  }, []);

  const viewModel: StaffAssignmentFilterViewModel = {
    assigneesFilterRef: controls.assigneesFilterRef,
    assigneesToComboOptions: useCase.assigneesToComboOptions,
    handleFilterAssignee: useCase.handleFilterAssignee,
    officeAssignees: store.officeAssignees,
    officeAssigneesError: store.officeAssigneesError,
  };

  return <StaffAssignmentFilterView viewModel={viewModel}></StaffAssignmentFilterView>;
};

const StaffAssignmentFilter = forwardRef(_StaffAssignmentFilter);
export default StaffAssignmentFilter;

export function useStaffAssignmentFilterControlsReact() {
  const assigneesFilterRef = useRef<ComboBoxRef>(null);

  return {
    assigneesFilterRef,
  };
}

export function useStaffAssignmentFilterStoreReact() {
  const [officeAssignees, setOfficeAssignees] = useState<CamsUserReference[]>([]);
  const [officeAssigneesError, setOfficeAssigneesError] = useState<boolean>(false);
  const [filterAssigneeCallback, setFilterAssigneeCallback] = useState<
    ((assignees: ComboOption[]) => void) | null
  >(null);
  const [focusOnRender, setFocusOnRender] = useState<boolean>(false);

  return {
    filterAssigneeCallback,
    focusOnRender,
    officeAssignees,
    officeAssigneesError,
    setFilterAssigneeCallback,
    setFocusOnRender,
    setOfficeAssignees,
    setOfficeAssigneesError,
  };
}
