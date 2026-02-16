import { ComboOption } from '@/lib/components/combobox/ComboBox';
import {
  StaffAssignmentFilterControls,
  StaffAssignmentFilterStore,
} from './staffAssignmentFilter.types';
import MockData from '@common/cams/test-utilities/mock-data';
import staffAssignmentFilterUseCase from './staffAssignmentFilterUseCase';
import LocalStorage from '@/lib/utils/local-storage';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import { UstpOfficeDetails } from '@common/cams/offices';
import Api2 from '@/lib/models/api2';
import MockApi2 from '@/lib/testing/mock-api2';
import { MockInstance } from 'vitest';
import { CamsUserReference } from '@common/cams/users';
import { ResponseBody } from '@common/api/response';

describe('staff assignment filter use case tests', () => {
  let mockFeatureFlags: FeatureFlagSet;
  let setOfficeAssigneesSpy: MockInstance<(val: CamsUserReference[]) => void>;
  let setOfficeAssigneesErrorSpy: MockInstance<(val: boolean) => void>;
  const assignees = MockData.buildArray(MockData.getCamsUserReference, 5);
  const mockStore: StaffAssignmentFilterStore = {
    officeAssignees: assignees,
    setOfficeAssignees: vi.fn(),
    officeAssigneesError: false,
    setOfficeAssigneesError: vi.fn(),
    filterAssigneeCallback: null,
    setFilterAssigneeCallback: vi.fn(),
    focusOnRender: false,
    setFocusOnRender: vi.fn(),
  };
  const comboBoxRef = {
    current: {
      setSelections: (_options: ComboOption[]) => {},
      getSelections: () => [
        {
          value: '',
          label: '',
          selected: false,
          hidden: false,
        },
      ],
      clearSelections: () => {},
      disable: (_value: boolean) => {},
      focusInput: () => {},
      focus: () => {},
    },
  };
  const mockControls: StaffAssignmentFilterControls = {
    assigneesFilterRef: comboBoxRef,
  };

  const useCase = staffAssignmentFilterUseCase(mockStore, mockControls);

  beforeEach(() => {
    const session = MockData.getCamsSession();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    // Reset the vi.fn() mocks before creating spies on them
    mockStore.setOfficeAssignees = vi.fn();
    mockStore.setOfficeAssigneesError = vi.fn();
    setOfficeAssigneesSpy = vi.spyOn(mockStore, 'setOfficeAssignees');
    setOfficeAssigneesErrorSpy = vi.spyOn(mockStore, 'setOfficeAssigneesError');
    mockFeatureFlags = {
      'chapter-eleven-enabled': true,
      'chapter-twelve-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  test('assigneesToComboOptions should return valid comboOptions for supplied assignees and unassigned option', async () => {
    const expectedComboOptions: ComboOption[] = [
      {
        label: '(unassigned)',
        value: 'UNASSIGNED',
        divider: true,
      },
    ];
    assignees.forEach((assignee) => {
      expectedComboOptions.push({
        label: assignee.name,
        value: assignee.id,
      });
    });

    const comboOptions = useCase.assigneesToComboOptions(assignees);
    expect(comboOptions).toEqual(expectedComboOptions);
  });

  test('getOfficeAssignees should return a unique and sorted array of assignees', async () => {
    const user1 = MockData.getCamsUserReference({ id: 'user-1', name: 'alfred' });
    const user2 = MockData.getCamsUserReference({ id: 'user-2', name: 'boe' });
    const user3 = MockData.getCamsUserReference({ id: 'user-3', name: 'frankie' });
    const mockStaff = [user3, user1, user2, user2, user1];
    const expectedAssignees = [user1, user2, user3];

    const offices: UstpOfficeDetails[] = [MockData.getOfficeWithStaff(mockStaff)];
    const callback = async (_officeCode: string): Promise<ResponseBody<CamsUserReference[]>> => {
      return Promise.resolve({ data: mockStaff });
    };

    const actualAssignees = await useCase.getOfficeAssignees(callback, offices);
    expect(actualAssignees).toEqual(expectedAssignees);
  });

  test('handleAssignmentChange should set officeAssignees to valid data if assignees were supplied and not display error', async () => {
    const responseBody = MockData.getPaginatedResponseBody(assignees);
    vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue(responseBody);

    await vi.waitFor(() => {
      useCase.fetchAssignees();
      expect(setOfficeAssigneesSpy).toHaveBeenCalledWith(
        assignees.sort((a, b) => (a.name < b.name ? -1 : 1)),
      );
    });

    expect(setOfficeAssigneesErrorSpy).toHaveBeenCalledWith(false);
  });

  test('handleAssignmentChange should set setOfficeAssigneesError to true and not set assignees', async () => {
    vi.spyOn(MockApi2, 'getOfficeAssignees').mockRejectedValue('error');

    await vi.waitFor(() => {
      useCase.fetchAssignees();
      expect(setOfficeAssigneesErrorSpy).toHaveBeenCalledWith(true);
    });

    expect(setOfficeAssigneesSpy).not.toHaveBeenCalled();
  });
});
