import { CamsUser, CamsUserReference, getCourtDivisionCodes } from '@common/cams/users';
import useFeatureFlags, {
  CHAPTER_ELEVEN_ENABLED,
  CHAPTER_TWELVE_ENABLED,
} from '@/lib/hooks/UseFeatureFlags';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { StaffAssignmentScreenFilter } from '../filters/staffAssignmentFilter.types';
import {
  StaffAssignmentControls,
  StaffAssignmentUseCase,
  StaffAssignmentStore,
} from './StaffAssignment.types';

const useStaffAssignmentUseCase = (
  store: StaffAssignmentStore,
  controls: StaffAssignmentControls,
): StaffAssignmentUseCase => {
  const handleFilterAssignee = (assignees: ComboOption[]) => {
    if (assignees[0] && assignees[0].value === 'UNASSIGNED') {
      const newFilter = {
        includeOnlyUnassigned: true,
      };
      store.setStaffAssignmentFilter(newFilter);
    } else if (assignees[0]) {
      const assignee: CamsUserReference = {
        id: assignees[0].value,
        name: assignees[0].label,
      };
      const newFilter = {
        assignee,
      };
      store.setStaffAssignmentFilter(newFilter);
    } else {
      store.setStaffAssignmentFilter(undefined);
    }
    controls.filterRef.current?.focus();
  };

  const refreshFilter = () => {
    controls.filterRef.current?.refresh();
  };

  const handleAssignmentChange = async () => {
    refreshFilter();
  };

  const getChapters = (): string[] => {
    const chapters = ['15'];
    const featureFlags = useFeatureFlags();
    if (featureFlags[CHAPTER_ELEVEN_ENABLED]) {
      chapters.push('11');
    }
    if (featureFlags[CHAPTER_TWELVE_ENABLED]) {
      chapters.push('12');
    }
    return chapters;
  };

  const getPredicateByUserContextWithFilter = (
    user: CamsUser,
    filter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate => {
    const predicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: getCourtDivisionCodes(user),
      chapters: getChapters(),
      excludeMemberConsolidations: true,
      excludeClosedCases: true,
    };

    if (filter?.includeOnlyUnassigned) {
      predicate.includeOnlyUnassigned = true;
    } else if (filter?.assignee) {
      predicate.assignments = [filter.assignee];
    }

    return predicate;
  };

  return {
    getChapters,
    getPredicateByUserContextWithFilter,
    handleAssignmentChange,
    handleFilterAssignee,
    refreshFilter,
  };
};

export { useStaffAssignmentUseCase };

export default useStaffAssignmentUseCase;
