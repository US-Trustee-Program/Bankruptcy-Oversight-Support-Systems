import { render, screen, waitFor } from '@testing-library/react';
import StaffAssignmentScreen from './StaffAssignmentScreen';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import MockData from '@common/cams/test-utilities/mock-data';
import * as searchResultsModule from '@/search-results/SearchResults';
import Api2 from '@/lib/models/api2';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { SearchResultsProps } from '@/search-results/SearchResults';
import { CamsRole } from '@common/cams/roles';
import { BrowserRouter } from 'react-router-dom';
import { getCourtDivisionCodes } from '@common/cams/users';
import { FeatureFlagSet } from '@common/feature-flags';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/offices';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

describe('StaffAssignmentScreen', () => {
  let mockFeatureFlags: FeatureFlagSet;
  let userEvent: CamsUserEvent;

  const user = MockData.getCamsUser({
    roles: [CamsRole.CaseAssignmentManager],
    offices: MOCKED_USTP_OFFICES_ARRAY,
  });

  function renderWithoutProps() {
    render(
      <BrowserRouter>
        <StaffAssignmentScreen></StaffAssignmentScreen>
      </BrowserRouter>,
    );
  }

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    TestingUtilities.setUser(user);

    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    mockFeatureFlags = {
      'chapter-eleven-enabled': false,
      'chapter-twelve-enabled': false,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('screen should contain staff assignment filters', async () => {
    const expectedAssignments = MockData.getStaffAssignee();
    vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue({
      data: [expectedAssignments],
    });
    renderWithoutProps();
    await TestingUtilities.waitForDocumentBody();

    const filter = document.querySelector('.staff-assignment-filter-container');
    expect(filter).toBeInTheDocument();
  });

  test('staff assignment filter should pass valid search predicate to search results component when changed filter is updated', async () => {
    const expectedAssignments = MockData.getStaffAssignee();

    vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue({
      data: [expectedAssignments],
    });

    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: MockData.buildArray(MockData.getSyncedCase, 3),
    });

    const expectedPredicate: CasesSearchPredicate = {
      assignments: [expectedAssignments],
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: getCourtDivisionCodes(user),
      chapters: ['15'],
      excludeMemberConsolidations: true,
      excludeClosedCases: true,
    };

    const SearchResults = vi
      .spyOn(searchResultsModule, 'default')
      .mockImplementation((_props: SearchResultsProps) => {
        return <></>;
      });

    renderWithoutProps();

    let comboBoxExpandButton;
    await waitFor(() => {
      comboBoxExpandButton = document.querySelector('#staff-assignees-expand');
      expect(comboBoxExpandButton).toBeInTheDocument();
    });

    await userEvent.click(comboBoxExpandButton!);

    let assigneeItem;
    await waitFor(() => {
      assigneeItem = screen.getByTestId('staff-assignees-option-item-1');
      expect(assigneeItem).toBeInTheDocument();
    });

    await userEvent.click(assigneeItem!);
    await userEvent.click(document.body);

    expect(SearchResults).toHaveBeenCalledWith(
      {
        id: 'search-results',
        noResultsAlertProps: {
          message: 'There are no cases currently assigned.',
          title: 'No Cases Assigned',
          type: UswdsAlertStyle.Warning,
        },
        searchPredicate: expectedPredicate,
        header: expect.anything(),
        row: expect.anything(),
      },
      undefined,
    );
  });

  test('should render a list of chapter 11, 12, and 15 cases for a case assignment manager to review', async () => {
    mockFeatureFlags = {
      'chapter-eleven-enabled': true,
      'chapter-twelve-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);

    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: MockData.buildArray(MockData.getSyncedCase, 3),
    });

    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: getCourtDivisionCodes(user),
      chapters: expect.arrayContaining(['11', '12', '15']),
      excludeMemberConsolidations: true,
      excludeClosedCases: true,
    };

    const SearchResults = vi
      .spyOn(searchResultsModule, 'default')
      .mockImplementation((_props: SearchResultsProps) => {
        return <></>;
      });

    renderWithoutProps();

    expect(SearchResults).toHaveBeenCalledWith(
      {
        id: 'search-results',
        noResultsAlertProps: {
          message: 'There are no cases currently assigned.',
          title: 'No Cases Assigned',
          type: UswdsAlertStyle.Warning,
        },
        searchPredicate: expectedPredicate,
        header: expect.anything(),
        row: expect.anything(),
      },
      undefined,
    );
  });

  test('should show an appropriate message when no cases are unassigned', async () => {
    const expectedAssignments = MockData.buildArray(MockData.getStaffAssignee, 5);
    vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue({
      data: expectedAssignments,
    });
    vi.spyOn(Api2, 'searchCases')
      .mockResolvedValueOnce({
        data: MockData.buildArray(MockData.getSyncedCase, 3),
      })
      .mockResolvedValueOnce({
        data: [],
      });

    const SearchResults = vi
      .spyOn(searchResultsModule, 'default')
      .mockImplementation((_props: SearchResultsProps) => {
        return <></>;
      });

    renderWithoutProps();

    await waitFor(() => {
      const filterContainer = document.querySelector('.staff-assignment-filter-container');
      expect(filterContainer).toBeInTheDocument();
    });

    const unassignedFilter = document.querySelector('#option-UNASSIGNED');
    expect(unassignedFilter).toBeInTheDocument();
    await userEvent.click(unassignedFilter!);

    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: getCourtDivisionCodes(user),
      includeOnlyUnassigned: true,
      excludeMemberConsolidations: true,
      excludeClosedCases: true,
      chapters: ['15'],
    };

    await waitFor(() => {
      expect(SearchResults.mock.calls.length).toBeGreaterThan(1);
    });

    expect(SearchResults.mock.calls[1][0]).toEqual({
      id: 'search-results',
      noResultsAlertProps: {
        message: 'There are no more cases to be assigned.',
        title: 'All Cases Assigned',
        type: UswdsAlertStyle.Info,
      },
      searchPredicate: expectedPredicate,
      header: expect.anything(),
      row: expect.anything(),
    });
  });

  describe('StaffAssignmentScreen - other errors', () => {
    const user = MockData.getCamsUser({
      roles: [CamsRole.CaseAssignmentManager],
      offices: MOCKED_USTP_OFFICES_ARRAY,
    });

    beforeEach(() => {
      TestingUtilities.setUser(user);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should render permission invalid error when CaseAssignmentManager is not found in user roles', async () => {
      TestingUtilities.setUserWithRoles([]);

      renderWithoutProps();

      expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
    });

    test('should show an alert if user has no offices', async () => {
      TestingUtilities.setUser({ offices: [], roles: [CamsRole.CaseAssignmentManager] });
      const SearchResults = vi.spyOn(searchResultsModule, 'default');

      renderWithoutProps();

      expect(SearchResults).not.toHaveBeenCalled();
      expect(screen.getByTestId('alert-container-no-office')).toBeInTheDocument();
    });
  });

  describe('StaffAssignmentScreen with global alert', () => {
    test('should properly handle and display global alert error when getOfficeAssignees throws', async () => {
      const globalAlertSpy = TestingUtilities.spyOnGlobalAlert();
      vi.spyOn(Api2, 'getOfficeAssignees').mockRejectedValueOnce('Error');
      const assigneeError = 'There was a problem getting the list of assignees.';
      renderWithoutProps();

      await waitFor(() => {
        const itemList = document.querySelector('#staff-assignment-filter');
        expect(itemList).not.toBeInTheDocument();
        expect(globalAlertSpy.error).toHaveBeenCalledWith(assigneeError);
      });
    });
  });
});
