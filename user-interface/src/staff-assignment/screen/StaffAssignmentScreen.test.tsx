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
import testingUtilities from '@/lib/testing/testing-utilities';
import { SearchResultsProps } from '@/search-results/SearchResults';
import { CamsRole } from '@common/cams/roles';
import { BrowserRouter } from 'react-router-dom';
import { getCourtDivisionCodes } from '@common/cams/users';
import { FeatureFlagSet } from '@common/feature-flags';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/offices';
import userEvent from '@testing-library/user-event';

describe('StaffAssignmentScreen', () => {
  let mockFeatureFlags: FeatureFlagSet;
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
    testingUtilities.setUser(user);

    vi.stubEnv('CAMS_PA11Y', 'true');
    mockFeatureFlags = {
      'chapter-eleven-enabled': false,
      'chapter-twelve-enabled': false,
      'staff-assignment-filter-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('screen should contain staff assignment filters', async () => {
    renderWithoutProps();

    const filter = document.querySelector('.staff-assignment-filter-container');
    expect(filter).toBeInTheDocument();
  });

  test('should properly handle error when getOfficeAssignees throws and display global alert error', async () => {
    vi.spyOn(Api2, 'getOfficeAssignees').mockRejectedValueOnce('Error');
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();
    const assigneeError = 'There was a problem getting the list of assignees.';
    renderWithoutProps();

    await waitFor(() => {
      const itemList = document.querySelector('#staff-assignment-filter');
      expect(itemList!).not.toBeInTheDocument();
    });
    expect(globalAlertSpy.error).toHaveBeenCalledWith(assigneeError);
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
      excludeChildConsolidations: true,
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
      assigneeItem = screen.getByTestId('staff-assignees-option-item-0');
      expect(assigneeItem).toBeInTheDocument();
    });

    await userEvent.click(assigneeItem!);
    await userEvent.click(document.body);

    expect(SearchResults).toHaveBeenCalledWith(
      {
        id: 'search-results',
        noResultsMessage: 'No cases currently assigned.',
        searchPredicate: expectedPredicate,
        header: expect.anything(),
        row: expect.anything(),
      },
      {},
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
      excludeChildConsolidations: true,
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
        noResultsMessage: 'No cases currently assigned.',
        searchPredicate: expectedPredicate,
        header: expect.anything(),
        row: expect.anything(),
      },
      {},
    );
  });

  test('should render permission invalid error when CaseAssignmentManager is not found in user roles', async () => {
    testingUtilities.setUserWithRoles([]);

    renderWithoutProps();

    expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
  });

  test('should show an alert if user has no offices', async () => {
    testingUtilities.setUser({ offices: [], roles: [CamsRole.CaseAssignmentManager] });
    const SearchResults = vi.spyOn(searchResultsModule, 'default');

    renderWithoutProps();

    expect(SearchResults).not.toHaveBeenCalled();
    expect(screen.getByTestId('alert-container-no-office')).toBeInTheDocument();
  });
});
