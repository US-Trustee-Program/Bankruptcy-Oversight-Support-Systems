import MockData from '@common/cams/test-utilities/mock-data';
import { StaffAssignmentStore } from './staffAssignmentStore';
import staffAssignmentUseCase from './staffAssignmentUseCase';
import LocalStorage from '@/lib/utils/local-storage';
import MockApi2 from '@/lib/testing/mock-api2';
import testingUtilities from '@/lib/testing/testing-utilities';
import Api2 from '@/lib/models/api2';
import { CamsUserReference } from '@common/cams/users';
import * as commonUsers from '@common/cams/users';
import { MockInstance } from 'vitest';
import { GlobalAlertRef } from '@/lib/components/cams/GlobalAlert/GlobalAlert';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { StaffAssignmentScreenFilter } from './staffAssignmentControls';
import { FeatureFlagSet } from '@common/feature-flags';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { ResponseBody } from '@common/api/response';
import { UstpOfficeDetails } from '@common/cams/offices';

describe('staff assignment use case tests', () => {
  let setOfficeAssigneesSpy: MockInstance<(val: CamsUserReference[]) => void>;
  let setOfficeAssigneesErrorSpy: MockInstance<(val: boolean) => void>;
  let setStaffAssignmentFilterSpy: MockInstance<
    (val: StaffAssignmentScreenFilter | undefined) => void
  >;
  const session = MockData.getCamsSession();
  let globalAlertSpy: GlobalAlertRef;
  let mockFeatureFlags: FeatureFlagSet;

  const assignees = MockData.buildArray(MockData.getCamsUserReference, 5);
  const mockStore: StaffAssignmentStore = {
    officeAssignees: assignees,
    setOfficeAssignees: vi.fn(),
    officeAssigneesError: false,
    setOfficeAssigneesError: vi.fn(),
    staffAssignmentFilter: undefined,
    setStaffAssignmentFilter: vi.fn(),
  };

  const useCase = staffAssignmentUseCase(mockStore);

  beforeEach(() => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    setOfficeAssigneesSpy = vi.spyOn(mockStore, 'setOfficeAssignees');
    setOfficeAssigneesErrorSpy = vi.spyOn(mockStore, 'setOfficeAssigneesError');
    setStaffAssignmentFilterSpy = vi.spyOn(mockStore, 'setStaffAssignmentFilter');
    globalAlertSpy = testingUtilities.spyOnGlobalAlert();
    mockFeatureFlags = {
      'chapter-eleven-enabled': true,
      'chapter-twelve-enabled': true,
      'staff-assignment-filter-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('assigneesToComboOptions should return valid comboOptions for supplied assignees', async () => {
    const expectedComboOptions: ComboOption[] = [];
    assignees.forEach((assignee) => {
      expectedComboOptions.push({
        label: assignee.name,
        value: assignee.id,
      });
    });

    const comboOptions = useCase.assigneesToComboOptions(assignees);
    expect(comboOptions).toEqual(expectedComboOptions);
  });

  test('handleAssignmentChange should set officeAssignees to valid data if assignees were supplied and not display error', async () => {
    const responseBody = MockData.getPaginatedResponseBody(assignees);
    vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue(responseBody);

    await vi.waitFor(() => {
      useCase.handleAssignmentChange(assignees);
      expect(setOfficeAssigneesSpy).toHaveBeenCalledWith(
        assignees.sort((a, b) => (a.name < b.name ? -1 : 1)),
      );
    });

    expect(setOfficeAssigneesErrorSpy).toHaveBeenCalledWith(false);
    expect(globalAlertSpy.error).not.toHaveBeenCalled();
  });

  test('handleAssignmentChange should set setOfficeAssigneesError to true and not set assignees', async () => {
    vi.spyOn(MockApi2, 'getOfficeAssignees').mockRejectedValue('error');

    await vi.waitFor(() => {
      useCase.handleAssignmentChange(assignees);
      expect(setOfficeAssigneesErrorSpy).toHaveBeenCalledWith(true);
    });

    expect(setOfficeAssigneesSpy).not.toHaveBeenCalled();
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

  test('handleFilterAssignee should set staffAssignmentFilter to undefined when array of assignees is empty', async () => {
    const comboOptions: ComboOption[] = [];

    useCase.handleFilterAssignee(comboOptions);
    expect(setStaffAssignmentFilterSpy).toHaveBeenCalledWith(undefined);
  });

  test('getOfficeAssignees should return a unique and sorted array of assignees', async () => {
    const mockStaff = [
      {
        id: '2',
        name: 'staff 2',
      },
      {
        id: '0',
        name: 'staff 0',
      },
      {
        id: '1',
        name: 'staff 1',
      },
      {
        id: '1',
        name: 'staff 1',
      },
      {
        id: '0',
        name: 'staff 0',
      },
    ];

    const expectedAssignees = [
      {
        id: '0',
        name: 'staff 0',
      },
      {
        id: '1',
        name: 'staff 1',
      },
      {
        id: '2',
        name: 'staff 2',
      },
    ];

    const offices: UstpOfficeDetails[] = [MockData.getOfficeWithStaff(mockStaff)];
    async function callback(_officeCode: string): Promise<ResponseBody<CamsUserReference[]>> {
      return Promise.resolve({ data: mockStaff });
    }

    const actualAssignees = await useCase.getOfficeAssignees(callback, offices);
    expect(actualAssignees).toEqual(expectedAssignees);
  });

  test('getPredicateByUserContextWithFilter should return a valid predicate when a valid filter is passed', async () => {
    const expectedDivisionCodes = ['081', '087'];
    const filter = { assignee: assignees[0] };
    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: expectedDivisionCodes,
      chapters: ['15', '11', '12'],
      assignments: [assignees[0]],
      excludeChildConsolidations: true,
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
      excludeChildConsolidations: true,
      excludeClosedCases: true,
    };
    vi.spyOn(commonUsers, 'getCourtDivisionCodes').mockReturnValue(expectedDivisionCodes);
    const newPredicate = useCase.getPredicateByUserContextWithFilter(session.user, undefined);
    expect(newPredicate).toEqual(expectedPredicate);
  });
});
