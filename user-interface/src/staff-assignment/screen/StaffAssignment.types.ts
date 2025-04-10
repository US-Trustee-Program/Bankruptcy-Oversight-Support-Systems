import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import {
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
} from '../filters/StaffAssignmentFilter.types';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal.types';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsSession } from '@common/cams/session';
import { CamsUser, CamsUserReference } from '@common/cams/users';
import { FeatureFlagSet } from '@common/feature-flags';
import { RefObject, ReactNode } from 'react';

interface Store {
  staffAssignmentFilter: StaffAssignmentScreenFilter | undefined;
  setStaffAssignmentFilter(val: StaffAssignmentScreenFilter | undefined): void;
}

interface Controls {
  infoModalRef: React.RefObject<ModalRefType>;
  assignmentModalRef: RefObject<AssignAttorneyModalRef>;
  filterRef: RefObject<StaffAssignmentFilterRef>;
  refreshFilter: (ref: RefObject<StaffAssignmentFilterRef>) => void;
}

interface ViewModel {
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
  handleAssignmentChange: (assignees: CamsUserReference[]) => void;
  handleFilterAssignee: (assignees: ComboOption[]) => void;
  StaffAssignmentRowClosure: (props: SearchResultsRowProps) => JSX.Element;
}

interface StaffAssignmentUseCase {
  handleFilterAssignee(assignees: ComboOption[]): void;
  handleAssignmentChange(assignees: CamsUserReference[]): void;
  getChapters(): string[];
  getPredicateByUserContextWithFilter(
    user: CamsUser,
    filter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate;
}

type StaffAssignmentScreenViewProps = {
  viewModel: ViewModel;
};

export type { Store, Controls, ViewModel, StaffAssignmentUseCase, StaffAssignmentScreenViewProps };
