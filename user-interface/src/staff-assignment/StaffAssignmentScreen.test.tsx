import { render } from '@testing-library/react';
import { StaffAssignmentScreen } from './StaffAssignmentScreen';
import { CasesSearchPredicate } from '@common/api/search';
import { CaseSummary } from '@common/cams/cases';
import { ResponseBodySuccess } from '@common/api/response';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import * as searchResultsModule from '@/search-results/SearchResults';
import * as genericApiModule from '@/lib/hooks/UseApi';
import { CamsUser } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';

describe('MyCasesScreen', () => {
  test('should render a list of cases assigned to a user', async () => {
    const user: CamsUser = MockData.getCamsUser();
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    const expectedResponse: ResponseBodySuccess<CaseSummary[]> = {
      meta: { self: 'a-uri', isPaginated: true, count: 3, limit: 50, currentPage: 1 },
      isSuccess: true,
      data: MockData.buildArray(MockData.getCaseSummary, 3),
    };
    vi.spyOn(genericApiModule, 'useGenericApi').mockReturnValue({
      get: vi.fn().mockResolvedValue(expectedResponse),
      post: vi.fn(),
      put: vi.fn(),
    });

    const expectedPredicate: CasesSearchPredicate = {
      chapters: ['15'],
      assignments: [getCamsUserReference(user)],
    };
    const SearchResults = vi.spyOn(searchResultsModule, 'SearchResults');

    render(<StaffAssignmentScreen></StaffAssignmentScreen>);

    expect(SearchResults).toHaveBeenCalledWith(
      {
        id: 'search-results',
        noResultsMessage: 'No cases currently assigned.',
        searchPredicate: expectedPredicate,
      },
      expect.any(Object),
    );
  });
});
