import MockData from '@common/cams/test-utilities/mock-data';
import { StaffAssignmentControls, StaffAssignmentStore } from './StaffAssignment.types';
import useStaffAssignmentUseCase from './staffAssignmentUseCase';
import LocalStorage from '@/lib/utils/local-storage';
import * as commonUsers from '@common/cams/users';
import { MockInstance } from 'vitest';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { FeatureFlagSet } from '@common/feature-flags';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { StaffAssignmentScreenFilter } from '../filters/staffAssignmentFilter.types';

const refreshSpy = vi.fn();

function useStaffAssignmentControlsMock(): StaffAssignmentControls {
  const infoModalRef = {
    current: {
      show: vi.fn(),
      hide: vi.fn(),
      buttons: {
        current: {
          disableSubmitButton: (_state: boolean) => {},
        },
      },
    },
  };

  const assignmentModalRef = {
    current: {
      show: vi.fn(),
      hide: vi.fn(),
      buttons: {
        current: {
          disableSubmitButton: (_state: boolean) => {},
        },
      },
    },
  };

  const filterRef = {
    current: {
      refresh: refreshSpy,
      focus: vi.fn(),
    },
  };

  return {
    assignmentModalRef,
    infoModalRef,
    filterRef,
  };
}

describe('staff assignment use case tests', () => {
  let setStaffAssignmentFilterSpy: MockInstance<
    (val: StaffAssignmentScreenFilter | undefined) => void
  >;
  const session = MockData.getCamsSession();
  let mockFeatureFlags: FeatureFlagSet;

  const assignees = MockData.buildArray(MockData.getCamsUserReference, 5);
  const mockStore: StaffAssignmentStore = {
    staffAssignmentFilter: undefined,
    setStaffAssignmentFilter: vi.fn(),
  };

  const mockControls = useStaffAssignmentControlsMock();

  const useCase = useStaffAssignmentUseCase(mockStore, mockControls);

  beforeEach(() => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    setStaffAssignmentFilterSpy = vi.spyOn(mockStore, 'setStaffAssignmentFilter');
    mockFeatureFlags = {
      'chapter-eleven-enabled': true,
      'chapter-twelve-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should call refresh on filterRef', async () => {
    useCase.handleAssignmentChange();
    expect(refreshSpy).toHaveBeenCalled();
  });

  test('handleFilterAssignee should set valid staffAssignmentFilter when array of assignees supplied', async () => {
    const comboOptions = [
      {
        label: assignees[0].name,
        value: assignees[0].id,
      },
    ];
    const expectedFilter = { assignee: assignees[0] };

    useCase.handleFilterAssignee(comboOptions);
    expect(setStaffAssignmentFilterSpy).toHaveBeenCalledWith(expectedFilter);
  });

  test('handleFilterAssignee should set valid staffAssignmentFilter when UNASSIGNED is supplied', async () => {
    const comboOptions = [
      {
        label: '(unassigned)',
        value: 'UNASSIGNED',
      },
    ];
    const expectedFilter = { includeOnlyUnassigned: true };

    useCase.handleFilterAssignee(comboOptions);
    expect(setStaffAssignmentFilterSpy).toHaveBeenCalledWith(expectedFilter);
  });

  test('handleFilterAssignee should set staffAssignmentFilter to undefined when array of assignees is empty', async () => {
    const comboOptions: ComboOption[] = [];

    useCase.handleFilterAssignee(comboOptions);
    expect(setStaffAssignmentFilterSpy).toHaveBeenCalledWith(undefined);
  });

  test('getPredicateByUserContextWithFilter should return a valid predicate when a valid filter is passed that is not UNASSIGNED', async () => {
    const expectedDivisionCodes = ['081', '087'];
    const filter = { assignee: assignees[0] };
    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: expectedDivisionCodes,
      chapters: ['15', '11', '12'],
      assignments: [assignees[0]],
      excludeMemberConsolidations: true,
      excludeClosedCases: true,
    };
    vi.spyOn(commonUsers, 'getCourtDivisionCodes').mockReturnValue(expectedDivisionCodes);
    const newPredicate = useCase.getPredicateByUserContextWithFilter(session.user, filter);
    expect(newPredicate).toEqual(expectedPredicate);
  });

  test('getPredicateByUserContextWithFilter should return a valid predicate when UNASSIGNED is passed as the filter', async () => {
    const expectedDivisionCodes = ['081', '087'];
    const filter = { includeOnlyUnassigned: true };
    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: expectedDivisionCodes,
      chapters: ['15', '11', '12'],
      includeOnlyUnassigned: true,
      excludeMemberConsolidations: true,
      excludeClosedCases: true,
    };
    vi.spyOn(commonUsers, 'getCourtDivisionCodes').mockReturnValue(expectedDivisionCodes);
    const newPredicate = useCase.getPredicateByUserContextWithFilter(session.user, filter);
    expect(newPredicate).toEqual(expectedPredicate);
  });

  test('getPredicateByUserContextWithFilter should return a valid predicate with assignments undefined if no filter is supplied', async () => {
    const expectedDivisionCodes = ['081', '087'];
    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: expectedDivisionCodes,
      chapters: ['15', '11', '12'],
      excludeMemberConsolidations: true,
      excludeClosedCases: true,
    };
    vi.spyOn(commonUsers, 'getCourtDivisionCodes').mockReturnValue(expectedDivisionCodes);
    const newPredicate = useCase.getPredicateByUserContextWithFilter(session.user, undefined);
    expect(newPredicate).toEqual(expectedPredicate);
  });
});
