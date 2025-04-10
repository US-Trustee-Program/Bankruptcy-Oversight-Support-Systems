import './StaffAssignmentScreen.scss';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import LocalStorage from '@/lib/utils/local-storage';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { StaffAssignmentRow } from '../row/StaffAssignmentRow';
import { CamsRole } from '@common/cams/roles';
import { staffAssignmentUseCase } from './staffAssignmentUseCase';
import { StaffAssignmentScreenView } from './StaffAssignmentScreenView';
import useFeatureFlags from '@/lib/hooks/UseFeatureFlags';
import {
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
} from '../filters/staffAssignmentFilter.types';
import { useRef, useState } from 'react';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { AssignAttorneyModalRef } from '../modal/assignAttorneyModal.types';
import { Controls, Store, ViewModel } from './staffAssignment.types';

const StaffAssignmentScreen = () => {
  const store: Store = useStaffAssignmentStoreReact();
  const controls: Controls = useStaffAssignmentControlsReact();
  const useCase = staffAssignmentUseCase(store, controls);

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
  const hasValidPermission =
    session?.user?.roles?.includes(CamsRole.CaseAssignmentManager) ?? false;
  const hasAssignedOffices = (session?.user?.offices && session?.user?.offices.length > 0) ?? false;

  const infoModalActionButtonGroup = {
    modalId: infoModalId,
    modalRef: controls.infoModalRef,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

  const viewModel: ViewModel = {
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

export function useStaffAssignmentStoreReact() {
  const [staffAssignmentFilter, setStaffAssignmentFilter] = useState<
    StaffAssignmentScreenFilter | undefined
  >();

  return {
    staffAssignmentFilter,
    setStaffAssignmentFilter,
  };
}

export function useStaffAssignmentControlsReact(): Controls {
  const infoModalRef = useRef<ModalRefType>(null);
  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);
  const filterRef = useRef<StaffAssignmentFilterRef>(null);
  const refreshFilter = (ref: React.RefObject<StaffAssignmentFilterRef>) => {
    ref.current?.refresh();
  };

  return {
    assignmentModalRef,
    infoModalRef,
    filterRef,
    refreshFilter,
  };
}
