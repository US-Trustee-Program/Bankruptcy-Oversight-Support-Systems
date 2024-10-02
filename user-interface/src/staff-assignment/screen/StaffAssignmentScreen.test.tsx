import { render } from '@testing-library/react';
import { StaffAssignmentScreen } from './StaffAssignmentScreen';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import MockData from '@common/cams/test-utilities/mock-data';
import * as searchResultsModule from '@/search-results/SearchResults';
import * as staffAssignmentRow from '../row/StaffAssignmentRow';
import Api2 from '@/lib/models/api2';
import testingUtilities from '@/lib/testing/testing-utilities';
import { SearchResultsProps } from '@/search-results/SearchResults';
import { CamsRole } from '@common/cams/roles';
import { BrowserRouter } from 'react-router-dom';
import { getCourtDivisionCodes } from '@common/cams/users';

describe('StaffAssignmentScreen', () => {
  test('should render a list of cases assigned to a case assignment manager', async () => {
    const user = testingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    testingUtilities.spyOnGlobalAlert();

    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: MockData.buildArray(MockData.getCaseBasics, 3),
    });

    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: getCourtDivisionCodes(user),
    };

    const SearchResults = vi
      .spyOn(searchResultsModule, 'SearchResults')
      .mockImplementation((props: SearchResultsProps) => {
        props.row({ bCase: MockData.getCaseBasics(), idx: 0, key: 0 });
        return <></>;
      });

    const staffAssignmentRowSpy = vi
      .spyOn(staffAssignmentRow, 'StaffAssignmentRow')
      .mockReturnValue(<></>);

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

    expect(staffAssignmentRowSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ modalId: 'assign-attorney-modal' }),
      }),
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
    testingUtilities.setUser({ offices: undefined, roles: [CamsRole.CaseAssignmentManager] });
    const SearchResults = vi.spyOn(searchResultsModule, 'SearchResults');

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
