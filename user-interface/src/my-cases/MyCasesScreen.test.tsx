import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MyCasesScreen } from './MyCasesScreen';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import * as searchResultsModule from '@/search-results/SearchResults';
import { CamsUser } from '@common/cams/users';
import { getCamsUserReference } from '@common/cams/session';
import { BrowserRouter } from 'react-router-dom';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import Api2 from '@/lib/hooks/UseApi2';

describe('MyCasesScreen', () => {
  const user: CamsUser = MockData.getCamsUser({});

  beforeEach(() => {
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should render an information modal', async () => {
    render(
      <BrowserRouter>
        <MyCasesScreen></MyCasesScreen>
      </BrowserRouter>,
    );

    const toggle = screen.getByTestId('open-modal-button');
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle!);

    const modal = screen.getByTestId('modal-content-info-modal');
    expect(modal).toBeInTheDocument();
  });

  test('should render a list of cases assigned to a user', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: MockData.buildArray(MockData.getCaseBasics, 3),
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
      const button = screen.getByTestId('open-modal-button');
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
