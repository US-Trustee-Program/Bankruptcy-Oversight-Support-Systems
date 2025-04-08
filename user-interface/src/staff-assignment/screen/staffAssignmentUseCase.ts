import { CamsUser, CamsUserReference, getCourtDivisionCodes } from '@common/cams/users';
import { StaffAssignmentStore } from './staffAssignmentStore';
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
import { StaffAssignmentControls } from './staffAssignmentControls';
import { StaffAssignmentScreenFilter } from '../filters/StaffAssignmentFilter';

export interface StaffAssignmentUseCase {
  handleFilterAssignee(assignees: ComboOption[]): void;
  handleAssignmentChange(assignees: CamsUserReference[]): void;
  getChapters(): string[];
  getPredicateByUserContextWithFilter(
    user: CamsUser,
    filter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate;
}

const staffAssignmentUseCase = (
  store: StaffAssignmentStore,
  controls: StaffAssignmentControls,
): StaffAssignmentUseCase => {
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
      controls?.filterRef?.current?.refresh();
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
