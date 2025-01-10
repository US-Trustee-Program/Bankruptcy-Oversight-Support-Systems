import { render } from '@testing-library/react';
import { StaffAssignmentScreen } from './StaffAssignmentScreen';
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

describe('StaffAssignmentScreen', () => {
  let mockFeatureFlags: FeatureFlagSet;

  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    mockFeatureFlags = {
      'chapter-eleven-enabled': false,
      'chapter-twelve-enabled': false,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render a list of chapter 15 cases for a case assignment manager to review', async () => {
    const user = testingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: MockData.buildArray(MockData.getCaseBasics, 3),
    });

    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: getCourtDivisionCodes(user),
      chapters: ['15'],
    };

    const SearchResults = vi
      .spyOn(searchResultsModule, 'default')
      .mockImplementation((_props: SearchResultsProps) => {
        return <></>;
      });

    render(
      <BrowserRouter>
        <StaffAssignmentScreen></StaffAssignmentScreen>
      </BrowserRouter>,
    );

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
    const user = testingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: MockData.buildArray(MockData.getCaseBasics, 3),
    });

    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: getCourtDivisionCodes(user),
      chapters: expect.arrayContaining(['11', '12', '15']),
    };

    const SearchResults = vi
      .spyOn(searchResultsModule, 'default')
      .mockImplementation((_props: SearchResultsProps) => {
        return <></>;
      });

    render(
      <BrowserRouter>
        <StaffAssignmentScreen></StaffAssignmentScreen>
      </BrowserRouter>,
    );

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
    const alertSpy = testingUtilities.spyOnGlobalAlert();
    render(
      <BrowserRouter>
        <StaffAssignmentScreen></StaffAssignmentScreen>
      </BrowserRouter>,
    );

    expect(alertSpy.error).toHaveBeenCalledWith('Invalid Permissions');
  });

  test('should default the divisionCodes in the predicate to an empty array if user has no offices', async () => {
    testingUtilities.setUser({ offices: [], roles: [CamsRole.CaseAssignmentManager] });
    const SearchResults = vi.spyOn(searchResultsModule, 'default');

    render(
      <BrowserRouter>
        <StaffAssignmentScreen></StaffAssignmentScreen>
      </BrowserRouter>,
    );

    expect(SearchResults).toHaveBeenCalledWith(
      {
        id: 'search-results',
        noResultsMessage: expect.anything(),
        searchPredicate: expect.objectContaining({ divisionCodes: [] }),
        header: expect.anything(),
        row: expect.anything(),
      },
      {},
    );
  });
});
