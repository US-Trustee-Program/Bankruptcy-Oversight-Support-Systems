import { render } from '@testing-library/react';
import { StaffAssignmentScreen } from './StaffAssignmentScreen';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { CaseSummary } from '@common/cams/cases';
import { buildResponseBody } from '@common/api/response';
import MockData from '@common/cams/test-utilities/mock-data';
import * as searchResultsModule from '@/search-results/SearchResults';
import * as genericApiModule from '@/lib/hooks/UseApi';
import * as staffAssignmentRow from '../row/StaffAssignmentRow';
import Api2 from '@/lib/hooks/UseApi2';
import testingUtilities from '@/lib/testing/testing-utilities';
import { SearchResultsProps } from '@/search-results/SearchResults';
import { CamsRole } from '@common/cams/roles';

describe('StaffAssignmentScreen', () => {
  test('should render a list of cases assigned to a case assignment manager', async () => {
    const user = testingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    testingUtilities.spyOnGlobalAlert();

    vi.spyOn(Api2, 'searchCases').mockResolvedValue(
      buildResponseBody(MockData.buildArray(MockData.getCaseBasics, 3)),
    );

    const expectedResponse: ResponseBody<CaseSummary[]> = {
      meta: { self: 'a-uri', isPaginated: true, count: 3, limit: 50, currentPage: 1 },
      isSuccess: true,
      data: MockData.buildArray(() => {
        return MockData.getCaseSummary({ entityType: 'person', override: { assignments: [] } });
      }, 3),
    };

    vi.spyOn(genericApiModule, 'useGenericApi').mockReturnValue({
      get: vi.fn().mockResolvedValue(expectedResponse),
      post: vi.fn().mockResolvedValue(expectedResponse),
      put: vi.fn(),
    });

    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      divisionCodes: user.offices?.map((office) => office.courtDivisionCode),
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

    render(<StaffAssignmentScreen></StaffAssignmentScreen>);

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
    render(<StaffAssignmentScreen></StaffAssignmentScreen>);

    expect(alertSpy.error).toHaveBeenCalledWith('Invalid Permissions');
  });

  test('should default the divisionCodes in the predicate to an empty array if user has no offices', async () => {
    testingUtilities.setUser({ offices: undefined, roles: [CamsRole.CaseAssignmentManager] });
    const SearchResults = vi.spyOn(searchResultsModule, 'SearchResults');

    render(<StaffAssignmentScreen></StaffAssignmentScreen>);

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
