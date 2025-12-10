import {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterProps,
  StaffAssignmentFilterRef,
  StaffAssignmentFilterStore,
  StaffAssignmentFilterViewModel,
} from './staffAssignmentFilter.types';
import { CamsUserReference } from '@common/cams/users';
import StaffAssignmentFilterView from './StaffAssignmentFilterView';
import staffAssignmentFilterUseCase from './staffAssignmentFilterUseCase';
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';
import { ComboOption } from '@/lib/components/combobox/ComboBox';

const StaffAssignmentFilter_ = (
  props: StaffAssignmentFilterProps,
  ref: React.Ref<StaffAssignmentFilterRef>,
) => {
  const store: StaffAssignmentFilterStore = useStaffAssignmentFilterStoreReact();
  const controls: StaffAssignmentFilterControls = useStaffAssignmentFilterControlsReact();
  const useCase = staffAssignmentFilterUseCase(store, controls);
  const globalAlert = useGlobalAlert();

  useImperativeHandle(ref, () => {
    return {
      refresh: useCase.fetchAssignees,
      focus: useCase.focusOnAssigneesFilter,
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
    officeAssignees: store.officeAssignees,
    officeAssigneesError: store.officeAssigneesError,
    handleFilterAssignee: useCase.handleFilterAssignee,
    assigneesToComboOptions: useCase.assigneesToComboOptions,
    assigneesFilterRef: controls.assigneesFilterRef,
  };

  return <StaffAssignmentFilterView viewModel={viewModel}></StaffAssignmentFilterView>;
};

const StaffAssignmentFilter = forwardRef(StaffAssignmentFilter_);
export default StaffAssignmentFilter;

function useStaffAssignmentFilterStoreReact() {
  const [officeAssignees, setOfficeAssignees] = useState<CamsUserReference[]>([]);
  const [officeAssigneesError, setOfficeAssigneesError] = useState<boolean>(false);
  const [filterAssigneeCallback, setFilterAssigneeCallback] = useState<
    ((assignees: ComboOption[]) => void) | null
  >(null);
  const [focusOnRender, setFocusOnRender] = useState<boolean>(false);

  return {
    filterAssigneeCallback,
    setFilterAssigneeCallback,
    focusOnRender,
    setFocusOnRender,
    officeAssignees,
    setOfficeAssignees,
    officeAssigneesError,
    setOfficeAssigneesError,
  };
}

function useStaffAssignmentFilterControlsReact() {
  const assigneesFilterRef = useRef<ComboBoxRef>(null);

  return {
    assigneesFilterRef,
  };
}
