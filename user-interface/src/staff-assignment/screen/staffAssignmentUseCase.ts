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
import LocalStorage from '@/lib/utils/local-storage';
import useApi2 from '@/lib/hooks/UseApi2';
import { ResponseBody } from '@common/api/response';
import { UstpOfficeDetails } from '@common/cams/offices';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { StaffAssignmentScreenFilter } from './staffAssignmentControls';

export interface StaffAssignmentUseCase {
  assigneesToComboOptions(officeAssignees: CamsUserReference[]): ComboOption[];
  fetchAssignees(): void;
  handleFilterAssignee(assignees: ComboOption[]): void;
  handleAssignmentChange(assignees: CamsUserReference[]): void;
  getChapters(): string[];
  getPredicateByUserContextWithFilter(
    user: CamsUser,
    filter?: StaffAssignmentScreenFilter,
  ): CasesSearchPredicate;
}

const staffAssignmentUseCase = (store: StaffAssignmentStore): StaffAssignmentUseCase => {
  const api = useApi2();
  const globalAlert = useGlobalAlert();

  function assigneesToComboOptions(officeAssignees: CamsUserReference[]): ComboOption[] {
    const comboOptions: ComboOption[] = [];
    officeAssignees.forEach((assignee) => {
      comboOptions.push({
        value: assignee.id,
        label: assignee.name,
      });
    });
    return comboOptions;
  }

  const fetchAssignees = () => {
    const session = LocalStorage.getSession();
    if (session?.user.offices) {
      const { offices } = session.user;
      getOfficeAssignees(api.getOfficeAssignees, offices)
        .then((assignees) => {
          store.setOfficeAssignees(assignees);
          store.setOfficeAssigneesError(false);
        })
        .catch((_e) => {
          store.setOfficeAssigneesError(true);
          globalAlert?.error('There was a problem getting the list of assignees.');
        });
    }
  };

  async function getOfficeAssignees(
    apiFunction: (office: string) => Promise<ResponseBody<CamsUserReference[]>>,
    offices: UstpOfficeDetails[],
  ): Promise<CamsUserReference[]> {
    const assigneeMap: Map<string, CamsUserReference> = new Map();
    for (const office of offices) {
      const assignees = await apiFunction(office.officeCode);
      assignees.data.forEach((assignee) => {
        if (!assigneeMap.has(assignee.id)) {
          assigneeMap.set(assignee.id, assignee);
        }
      });
    }
    return Array.from(assigneeMap.values()).sort((a, b) => (a.name < b.name ? -1 : 1));
  }

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

  function handleAssignmentChange(assignees: CamsUserReference[]) {
    if (assignees.length) {
      fetchAssignees();
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
    assigneesToComboOptions,
    fetchAssignees,
    getChapters,
    getPredicateByUserContextWithFilter,
    handleAssignmentChange,
    handleFilterAssignee,
  };
};

export { staffAssignmentUseCase };
