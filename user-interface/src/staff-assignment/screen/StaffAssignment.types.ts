import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsSession } from '@common/cams/session';
import { CamsUser, CamsUserReference } from '@common/cams/users';
import { FeatureFlagSet } from '@common/feature-flags';
import { ReactNode, RefObject } from 'react';

import {
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
} from '../filters/staffAssignmentFilter.types';
import { AssignAttorneyModalRef } from '../modal/assignAttorneyModal.types';

interface StaffAssignmentControls {
  assignmentModalRef: RefObject<AssignAttorneyModalRef>;
  filterRef: RefObject<StaffAssignmentFilterRef>;
  infoModalRef: React.RefObject<ModalRefType>;
}

type StaffAssignmentScreenViewProps = {
  viewModel: StaffAssignmentViewModel;
};

interface StaffAssignmentStore {
  setStaffAssignmentFilter(val: StaffAssignmentScreenFilter | undefined): void;
  staffAssignmentFilter: StaffAssignmentScreenFilter | undefined;
}

interface StaffAssignmentUseCase {
  getChapters(): string[];
  getPredicateByUserContextWithFilter(
    user: CamsUser,
    filter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate;
  handleAssignmentChange(): void;
  handleFilterAssignee(assignees: ComboOption[]): void;
  refreshFilter: () => void;
}

interface StaffAssignmentViewModel {
  assignmentModalId: string;
  assignmentModalRef: React.Ref<AssignAttorneyModalRef> | undefined;
  featureFlags: FeatureFlagSet;
  filterRef: React.Ref<StaffAssignmentFilterRef> | undefined;
  getPredicateByUserContextWithFilter(
    user: CamsUserReference,
    staffAssignmentFilter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate;
  handleAssignmentChange: () => void;
  handleFilterAssignee: (assignees: ComboOption[]) => void;
  hasAssignedOffices: boolean;
  hasValidPermission: boolean;
  infoModalActionButtonGroup: SubmitCancelBtnProps;
  infoModalId: string;
  infoModalRef: RefObject<ModalRefType>;

  screenTitle: ReactNode;
  session: CamsSession | null;
  staffAssignmentFilter: StaffAssignmentScreenFilter | undefined;
  StaffAssignmentRowClosure: (props: SearchResultsRowProps) => JSX.Element;
}

export type {
  StaffAssignmentControls,
  StaffAssignmentScreenViewProps,
  StaffAssignmentStore,
  StaffAssignmentUseCase,
  StaffAssignmentViewModel,
};
