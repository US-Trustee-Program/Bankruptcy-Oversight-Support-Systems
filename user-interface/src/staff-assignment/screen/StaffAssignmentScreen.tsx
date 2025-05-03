import './StaffAssignmentScreen.scss';

import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import useFeatureFlags from '@/lib/hooks/UseFeatureFlags';
import LocalStorage from '@/lib/utils/local-storage';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { CamsRole } from '@common/cams/roles';
import { useRef, useState } from 'react';

import {
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
} from '../filters/staffAssignmentFilter.types';
import { AssignAttorneyModalRef } from '../modal/assignAttorneyModal.types';
import { StaffAssignmentRow } from '../row/StaffAssignmentRow';
import {
  StaffAssignmentControls,
  StaffAssignmentStore,
  StaffAssignmentViewModel,
} from './StaffAssignment.types';
import { StaffAssignmentScreenView } from './StaffAssignmentScreenView';
import { useStaffAssignmentUseCase } from './staffAssignmentUseCase';

const StaffAssignmentScreen = () => {
  const store: StaffAssignmentStore = useStaffAssignmentStoreReact();
  const controls: StaffAssignmentControls = useStaffAssignmentControlsReact();
  const useCase = useStaffAssignmentUseCase(store, controls);

  const infoModalId = 'info-modal';
  const assignmentModalId = 'assign-attorney-modal';

  function StaffAssignmentRowClosure(props: SearchResultsRowProps) {
    return StaffAssignmentRow({
      ...props,
      options: { modalId: assignmentModalId, modalRef: controls.assignmentModalRef },
    });
  }

  const featureFlags = useFeatureFlags();
  const session = LocalStorage.getSession();
  const hasValidPermission = !!session?.user?.roles?.includes(CamsRole.CaseAssignmentManager);
  const hasAssignedOffices = !!(session?.user?.offices && session?.user?.offices.length > 0);

  const infoModalActionButtonGroup = {
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
    modalId: infoModalId,
    modalRef: controls.infoModalRef,
  };

  const viewModel: StaffAssignmentViewModel = {
    assignmentModalId,

    assignmentModalRef: controls.assignmentModalRef,
    featureFlags,
    filterRef: controls.filterRef,
    getPredicateByUserContextWithFilter: useCase.getPredicateByUserContextWithFilter,
    handleAssignmentChange: useCase.handleAssignmentChange,
    handleFilterAssignee: useCase.handleFilterAssignee,
    hasAssignedOffices,
    hasValidPermission,
    infoModalActionButtonGroup,
    infoModalId,
    infoModalRef: controls.infoModalRef,

    screenTitle: 'Staff Assignment',
    session,
    staffAssignmentFilter: store.staffAssignmentFilter,
    StaffAssignmentRowClosure,
  };

  return <StaffAssignmentScreenView viewModel={viewModel}></StaffAssignmentScreenView>;
};

export default StaffAssignmentScreen;

export function useStaffAssignmentControlsReact(): StaffAssignmentControls {
  const infoModalRef = useRef<ModalRefType>(null);
  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);
  const filterRef = useRef<StaffAssignmentFilterRef>(null);

  return {
    assignmentModalRef,
    filterRef,
    infoModalRef,
  };
}

export function useStaffAssignmentStoreReact() {
  const [staffAssignmentFilter, setStaffAssignmentFilter] = useState<
    StaffAssignmentScreenFilter | undefined
  >();

  return {
    setStaffAssignmentFilter,
    staffAssignmentFilter,
  };
}
