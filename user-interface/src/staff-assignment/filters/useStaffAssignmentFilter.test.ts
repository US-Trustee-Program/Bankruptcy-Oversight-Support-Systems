import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { StaffAssignmentFilterControls } from './staffAssignmentFilter.types';
import MockData from '@common/cams/test-utilities/mock-data';
import { useStaffAssignmentFilter } from './useStaffAssignmentFilter';
import LocalStorage from '@/lib/utils/local-storage';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import MockApi2 from '@/lib/testing/mock-api2';
import { renderHook, waitFor } from '@testing-library/react';

describe('staff assignment filter hook tests', () => {
  let mockFeatureFlags: FeatureFlagSet;
  const assignees = MockData.buildArray(MockData.getCamsUserReference, 5);
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

  beforeEach(() => {
    const session = MockData.getCamsSession();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);
    mockFeatureFlags = {
      'chapter-eleven-enabled': true,
      'chapter-twelve-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('assigneesToComboOptions should return valid comboOptions for supplied assignees and unassigned option', async () => {
    const { result } = renderHook(() => useStaffAssignmentFilter(mockControls));

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

    const comboOptions = result.current.assigneesToComboOptions(assignees);
    expect(comboOptions).toEqual(expectedComboOptions);
  });

  test('fetchAssignees should set officeAssignees to valid data if assignees were supplied and not display error', async () => {
    const responseBody = MockData.getPaginatedResponseBody(assignees);
    vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue(responseBody);

    const { result } = renderHook(() => useStaffAssignmentFilter(mockControls));

    await waitFor(() => {
      expect(result.current.store.officeAssignees).toEqual(
        assignees.sort((a, b) => (a.name < b.name ? -1 : 1)),
      );
      expect(result.current.store.officeAssigneesError).toBe(false);
    });
  });

  test('fetchAssignees should set officeAssigneesError to true and not set assignees on error', async () => {
    vi.spyOn(MockApi2, 'getOfficeAssignees').mockRejectedValue('error');

    const { result } = renderHook(() => useStaffAssignmentFilter(mockControls));

    await waitFor(() => {
      expect(result.current.store.officeAssigneesError).toBe(true);
    });
  });
});
