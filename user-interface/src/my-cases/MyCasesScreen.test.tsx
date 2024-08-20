import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MyCasesScreen } from './MyCasesScreen';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { CaseSummary } from '@common/cams/cases';
import { ResponseBodySuccess } from '@common/api/response';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import * as searchResultsModule from '@/search-results/SearchResults';
import * as genericApiModule from '@/lib/hooks/UseApi';
import { CamsUser } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';
import { BrowserRouter } from 'react-router-dom';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';

describe('MyCasesScreen', () => {
  const user: CamsUser = MockData.getCamsUser({});

  beforeEach(() => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should render an information modal', async () => {
    render(<MyCasesScreen></MyCasesScreen>);

    const toggle = await screen.findByTestId('toggle-modal-button');
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle!);

    const modal = await screen.findByTestId('modal-content-info-modal');
    expect(modal).toBeInTheDocument();
  });

  test('should render a list of cases assigned to a user', async () => {
    const expectedResponse: ResponseBodySuccess<CaseSummary[]> = {
      meta: {
        self: 'a-uri',
        isPaginated: true,
        count: 3,
        limit: DEFAULT_SEARCH_LIMIT,
        currentPage: 1,
      },
      isSuccess: true,
      data: MockData.buildArray(MockData.getCaseSummary, 3),
    };
    vi.spyOn(genericApiModule, 'useGenericApi').mockReturnValue({
      get: vi.fn().mockResolvedValue(expectedResponse),
      post: vi.fn().mockResolvedValue(expectedResponse),
      put: vi.fn(),
    });

    const expectedPredicate: CasesSearchPredicate = {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
      assignments: [getCamsUserReference(user)],
    };
    const SearchResults = vi.spyOn(searchResultsModule, 'SearchResults');

    render(
      <BrowserRouter>
        <MyCasesScreen></MyCasesScreen>
      </BrowserRouter>,
    );

    await waitFor(() => {
      const button = screen.getByTestId('toggle-modal-button');
      expect(button).toBeInTheDocument();
    });
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

  test('should render "Invalid user expectation" if user has no offices', () => {
    const user = testingUtilities.setUser({
      offices: undefined,
      roles: [CamsRole.CaseAssignmentManager],
    });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));

    render(<MyCasesScreen></MyCasesScreen>);

    const body = document.querySelector('body');
    expect(body).toHaveTextContent('Invalid user expectation');
  });
});
