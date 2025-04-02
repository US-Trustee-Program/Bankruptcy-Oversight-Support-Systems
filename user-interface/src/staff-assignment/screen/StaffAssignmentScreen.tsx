import './StaffAssignmentScreen.scss';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import LocalStorage from '@/lib/utils/local-storage';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { StaffAssignmentRow } from '../row/StaffAssignmentRow';
import { CamsRole } from '@common/cams/roles';
import { useStaffAssignmentStoreReact } from './staffAssignmentStoreReact';
import { StaffAssignmentStore } from './staffAssignmentStore';
import { StaffAssignmentControls } from './staffAssignmentControls';
import { useStaffAssignmentControlsReact } from './staffAssignmentControlsReact';
import { staffAssignmentUseCase } from './staffAssignmentUseCase';
import { StaffAssignmentScreenView } from './StaffAssignmentScreenView';
import { StaffAssignmentViewModel } from './staffAssignmentViewModel';
import useFeatureFlags from '@/lib/hooks/UseFeatureFlags';
import { useEffect } from 'react';

const StaffAssignmentScreen = () => {
  const store: StaffAssignmentStore = useStaffAssignmentStoreReact();
  const controls: StaffAssignmentControls = useStaffAssignmentControlsReact();
  const useCase = staffAssignmentUseCase(store);

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

  const viewModel: StaffAssignmentViewModel = {
    screenTitle: 'Staff Assignment',

    assignmentModalId,
    assignmentModalRef: controls.assignmentModalRef,
    featureFlags,
    hasAssignedOffices,
    hasValidPermission,
    infoModalActionButtonGroup,
    infoModalId,
    infoModalRef: controls.infoModalRef,
    officeAssignees: store.officeAssignees,
    officeAssigneesError: store.officeAssigneesError,
    session,
    staffAssignmentFilter: store.staffAssignmentFilter,

    assigneesToComboOptions: useCase.assigneesToComboOptions,
    getPredicateByUserContextWithFilter: useCase.getPredicateByUserContextWithFilter,
    handleAssignmentChange: useCase.handleAssignmentChange,
    handleFilterAssignee: useCase.handleFilterAssignee,
    StaffAssignmentRowClosure,
  };

  useEffect(() => {
    useCase.fetchAssignees();
  }, []);

  return <StaffAssignmentScreenView viewModel={viewModel}></StaffAssignmentScreenView>;
};

export default StaffAssignmentScreen;
