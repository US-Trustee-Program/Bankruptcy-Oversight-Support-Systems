import './StaffAssignmentScreen.scss';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import LocalStorage from '@/lib/utils/local-storage';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { StaffAssignmentRow } from '../row/StaffAssignmentRow';
import { CamsRole } from '@common/cams/roles';
import { useStaffAssignmentUseCase } from './staffAssignmentUseCase';
import { StaffAssignmentScreenView } from './StaffAssignmentScreenView';
import useFeatureFlags from '@/lib/hooks/UseFeatureFlags';
import {
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
} from '../filters/staffAssignmentFilter.types';
import { useRef, useState } from 'react';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { AssignAttorneyModalRef } from '../modal/assignAttorneyModal.types';
import {
  StaffAssignmentControls,
  StaffAssignmentStore,
  StaffAssignmentViewModel,
} from './StaffAssignment.types';

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
    modalId: infoModalId,
    modalRef: controls.infoModalRef,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

  const viewModel: StaffAssignmentViewModel = {
    screenTitle: 'Staff Assignment',

    assignmentModalId,
    assignmentModalRef: controls.assignmentModalRef,
    filterRef: controls.filterRef,
    featureFlags,
    hasAssignedOffices,
    hasValidPermission,
    infoModalActionButtonGroup,
    infoModalId,
    infoModalRef: controls.infoModalRef,
    session,
    staffAssignmentFilter: store.staffAssignmentFilter,

    getPredicateByUserContextWithFilter: useCase.getPredicateByUserContextWithFilter,
    handleAssignmentChange: useCase.handleAssignmentChange,
    handleFilterAssignee: useCase.handleFilterAssignee,
    StaffAssignmentRowClosure,
  };

  return <StaffAssignmentScreenView viewModel={viewModel}></StaffAssignmentScreenView>;
};

export default StaffAssignmentScreen;

function useStaffAssignmentStoreReact() {
  const [staffAssignmentFilter, setStaffAssignmentFilter] = useState<
    StaffAssignmentScreenFilter | undefined
  >();

  return {
    staffAssignmentFilter,
    setStaffAssignmentFilter,
  };
}

function useStaffAssignmentControlsReact(): StaffAssignmentControls {
  const infoModalRef = useRef<ModalRefType>(null);
  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);
  const filterRef = useRef<StaffAssignmentFilterRef>(null);

  return {
    assignmentModalRef,
    infoModalRef,
    filterRef,
  };
}
