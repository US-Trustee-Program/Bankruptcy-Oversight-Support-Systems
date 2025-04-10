import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { Store } from './staffAssignmentFilter.types';
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
  const mockStore: Store = {
    officeAssignees: assignees,
    setOfficeAssignees: vi.fn(),
    officeAssigneesError: false,
    setOfficeAssigneesError: vi.fn(),
  };

  const useCase = staffAssignmentFilterUseCase(mockStore);

  beforeEach(() => {
    const session = MockData.getCamsSession();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    setOfficeAssigneesSpy = vi.spyOn(mockStore, 'setOfficeAssignees');
    setOfficeAssigneesErrorSpy = vi.spyOn(mockStore, 'setOfficeAssigneesError');
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

  test('getOfficeAssignees should return a unique and sorted array of assignees', async () => {
    const user1 = MockData.getCamsUserReference({ name: 'alfred' });
    const user2 = MockData.getCamsUserReference({ name: 'boe' });
    const user3 = MockData.getCamsUserReference({ name: 'frankie' });
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
