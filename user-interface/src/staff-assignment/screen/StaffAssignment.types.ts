import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import {
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
} from '../filters/staffAssignmentFilter.types';
import { AssignAttorneyModalRef } from '../modal/assignAttorneyModal.types';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsSession } from '@common/cams/session';
import { CamsUser, CamsUserReference } from '@common/cams/users';
import { FeatureFlagSet } from '@common/feature-flags';
import { RefObject, ReactNode } from 'react';

interface StaffAssignmentStore {
  staffAssignmentFilter: StaffAssignmentScreenFilter | undefined;
  setStaffAssignmentFilter(val: StaffAssignmentScreenFilter | undefined): void;
}

interface StaffAssignmentControls {
  infoModalRef: React.RefObject<ModalRefType>;
  assignmentModalRef: RefObject<AssignAttorneyModalRef>;
  filterRef: RefObject<StaffAssignmentFilterRef>;
}

interface StaffAssignmentViewModel {
  assignmentModalId: string;
  assignmentModalRef: React.Ref<AssignAttorneyModalRef> | undefined;
  featureFlags: FeatureFlagSet;
  filterRef: React.Ref<StaffAssignmentFilterRef> | undefined;
  hasAssignedOffices: boolean;
  hasValidPermission: boolean;
  infoModalActionButtonGroup: SubmitCancelBtnProps;
  infoModalId: string;
  infoModalRef: RefObject<ModalRefType>;
  screenTitle: ReactNode;
  session: CamsSession | null;
  staffAssignmentFilter: StaffAssignmentScreenFilter | undefined;

  getPredicateByUserContextWithFilter(
    user: CamsUserReference,
    staffAssignmentFilter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate;
  handleAssignmentChange: () => void;
  handleFilterAssignee: (assignees: ComboOption[]) => void;
  StaffAssignmentRowClosure: (props: SearchResultsRowProps) => JSX.Element;
}

interface StaffAssignmentUseCase {
  handleFilterAssignee(assignees: ComboOption[]): void;
  handleAssignmentChange(): void;
  getChapters(): string[];
  getPredicateByUserContextWithFilter(
    user: CamsUser,
    filter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate;
  refreshFilter: () => void;
}

type StaffAssignmentScreenViewProps = {
  viewModel: StaffAssignmentViewModel;
};

export type {
  StaffAssignmentStore,
  StaffAssignmentControls,
  StaffAssignmentViewModel,
  StaffAssignmentUseCase,
  StaffAssignmentScreenViewProps,
};
