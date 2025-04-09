import { CamsUser, CamsUserReference, getCourtDivisionCodes } from '@common/cams/users';
import { Store, Controls, StaffAssignmentUseCase } from './StaffAssignment.types';
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

const staffAssignmentUseCase = (store: Store, controls: Controls): StaffAssignmentUseCase => {
  function handleFilterAssignee(assignees: ComboOption[]) {
    if (assignees[0]) {
      const assignee: CamsUserReference = {
        id: assignees[0].value,
        name: assignees[0].label,
      };
      const newFilter = {
        ...store.staffAssignmentFilter,
        assignee,
      };
      store.setStaffAssignmentFilter(newFilter);
    } else {
      store.setStaffAssignmentFilter(undefined);
    }
  }

  async function handleAssignmentChange(assignees: CamsUserReference[]) {
    if (assignees.length > 0) {
      controls.refreshFilter(controls.filterRef);
    }
  }

  function getChapters(): string[] {
    const chapters = ['15'];
    const featureFlags = useFeatureFlags();
    if (featureFlags[CHAPTER_ELEVEN_ENABLED]) {
      chapters.push('11');
    }
    if (featureFlags[CHAPTER_TWELVE_ENABLED]) {
      chapters.push('12');
    }
    return chapters;
  }

  function getPredicateByUserContextWithFilter(
    user: CamsUser,
    filter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate {
    const predicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: getCourtDivisionCodes(user),
      chapters: getChapters(),
      assignments: filter?.assignee ? [filter.assignee] : undefined,
      excludeChildConsolidations: true,
      excludeClosedCases: true,
    };

    return predicate;
  }

  return {
    getChapters,
    getPredicateByUserContextWithFilter,
    handleAssignmentChange,
    handleFilterAssignee,
  };
};

export { staffAssignmentUseCase };

export default staffAssignmentUseCase;
