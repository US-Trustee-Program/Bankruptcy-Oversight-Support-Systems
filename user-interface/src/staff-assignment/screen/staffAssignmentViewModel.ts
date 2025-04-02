import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { CasesSearchPredicate } from '@common/api/search';
import { CamsSession } from '@common/cams/session';
import { CamsUserReference } from '@common/cams/users';
import { FeatureFlagSet } from '@common/feature-flags';
import { RefObject, ReactNode } from 'react';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { StaffAssignmentScreenFilter } from './staffAssignmentControls';

interface StaffAssignmentViewModel {
  assignmentModalId: string;
  assignmentModalRef: React.Ref<AssignAttorneyModalRef> | undefined;
  featureFlags: FeatureFlagSet;
  hasAssignedOffices: boolean;
  hasValidPermission: boolean;
  infoModalActionButtonGroup: SubmitCancelBtnProps;
  infoModalId: string;
  infoModalRef: RefObject<ModalRefType>;
  screenTitle: ReactNode;
  session: CamsSession | null;
  staffAssignmentFilter: StaffAssignmentScreenFilter | undefined;
  officeAssignees: CamsUserReference[];
  officeAssigneesError: boolean;

  assigneesToComboOptions: (assignees: CamsUserReference[]) => ComboOption[];
  getPredicateByUserContextWithFilter(
    user: CamsUserReference,
    staffAssignmentFilter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate;
  handleAssignmentChange: (assignees: CamsUserReference[]) => void;
  handleFilterAssignee: (assignees: ComboOption[]) => void;
  StaffAssignmentRowClosure: (props: SearchResultsRowProps) => JSX.Element;
}

export type { StaffAssignmentViewModel };
