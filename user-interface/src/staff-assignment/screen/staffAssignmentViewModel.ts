import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsSession } from '@common/cams/session';
import { CamsUserReference } from '@common/cams/users';
import { FeatureFlagSet } from '@common/feature-flags';
import { LegacyRef, RefObject, ReactNode } from 'react';
import {
  StaffAssignmentFilterRef,
  StaffAssignmentScreenFilter,
} from '../filters/StaffAssignmentFilter';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';

interface StaffAssignmentViewModel {
  assignmentModalId: string;
  assignmentModalRef: React.Ref<AssignAttorneyModalRef> | undefined;
  featureFlags: FeatureFlagSet;
  filterRef: LegacyRef<StaffAssignmentFilterRef> | undefined;
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
  handleFilterAssignee: ((assignee: CamsUserReference | undefined) => void) | undefined;
  StaffAssignmentRowClosure: (props: SearchResultsRowProps) => JSX.Element;
}

export type { StaffAssignmentViewModel };
