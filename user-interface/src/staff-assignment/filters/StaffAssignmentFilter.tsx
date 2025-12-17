import {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterProps,
  StaffAssignmentFilterRef,
  StaffAssignmentFilterViewModel,
} from './staffAssignmentFilter.types';
import StaffAssignmentFilterView from './StaffAssignmentFilterView';
import { useStaffAssignmentFilter } from './useStaffAssignmentFilter';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ComboBoxRef } from '@/lib/type-declarations/input-fields';

const StaffAssignmentFilter_ = (
  props: StaffAssignmentFilterProps,
  ref: React.Ref<StaffAssignmentFilterRef>,
) => {
  const controls: StaffAssignmentFilterControls = useStaffAssignmentFilterControlsReact();
  const { store, useCase } = useStaffAssignmentFilter(controls);
  const globalAlert = useGlobalAlert();

  useImperativeHandle(ref, () => {
    return {
      refresh: useCase.fetchAssignees,
      focus: useCase.focusOnAssigneesFilter,
    };
  });

  // Only component-level effect: global alert on error
  useEffect(() => {
    if (store.officeAssigneesError) {
      globalAlert?.error('There was a problem getting the list of assignees.');
    }
  }, [globalAlert, store.officeAssigneesError]);

  const viewModel: StaffAssignmentFilterViewModel = {
    officeAssignees: store.officeAssignees,
    officeAssigneesError: store.officeAssigneesError,
    handleFilterAssignee: props.handleFilterAssignee ?? useCase.handleFilterAssignee,
    assigneesToComboOptions: useCase.assigneesToComboOptions,
    assigneesFilterRef: controls.assigneesFilterRef,
  };

  return <StaffAssignmentFilterView viewModel={viewModel}></StaffAssignmentFilterView>;
};

const StaffAssignmentFilter = forwardRef(StaffAssignmentFilter_);
export default StaffAssignmentFilter;

function useStaffAssignmentFilterControlsReact() {
  const assigneesFilterRef = useRef<ComboBoxRef>(null);

  return useMemo(
    () => ({
      assigneesFilterRef,
    }),
    [],
  );
}
