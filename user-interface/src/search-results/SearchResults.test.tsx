import MockData from '@common/cams/test-utilities/mock-data';
import { SyncedCase } from '@common/cams/cases';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CasesSearchPredicate, DEFAULT_SEARCH_LIMIT } from '@common/api/search';
import SearchResults, { SearchResultsProps } from './SearchResults';
import { BrowserRouter } from 'react-router-dom';
import { SearchResultsHeader } from '@/search/SearchResultsHeader';
import { SearchResultsRow } from '@/search/SearchResultsRow';
import Api2 from '@/lib/models/api2';
import { CamsHttpError } from '@/lib/models/api';

describe('SearchResults component tests', () => {
  let caseList: SyncedCase[];
  const onStartSearchingSpy = vi.fn();
  const onEndSearchingSpy = vi.fn();

  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    caseList = MockData.buildArray(MockData.getSyncedCase, 60);
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      meta: {
        self: 'self-link',
      },
      pagination: {
        currentPage: 1,
        limit: DEFAULT_SEARCH_LIMIT,
        count: caseList.length,
        next: 'next-link',
        totalPages: Math.ceil(caseList.length / DEFAULT_SEARCH_LIMIT),
      },
      data: caseList,
    });
  });

  function renderWithProps(props: Partial<SearchResultsProps> = {}) {
    const defaultProps: SearchResultsProps = {
      id: 'search-results',
      searchPredicate: {
        caseNumber: '00-11111',
        limit: 25,
        offset: 0,
      },
      onStartSearching: onStartSearchingSpy,
      onEndSearching: onEndSearchingSpy,
      header: SearchResultsHeader,
      row: SearchResultsRow,
    };
    render(
      <BrowserRouter>
        <SearchResults {...defaultProps} {...props}></SearchResults>{' '}
      </BrowserRouter>,
    );
  }

  test('should render a list of cases with a valid search predicate', async () => {
    const caseNumber = '00-11111';
    const searchPredicate: CasesSearchPredicate = {
      caseNumber,
      limit: 25,
      offset: 0,
    };

    renderWithProps({ searchPredicate });

    let table = document.querySelector('.search-results table');
    expect(table).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);
  });

  test('should show the no results alert when no results are available', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      meta: {
        self: 'self-link',
      },
      pagination: {
        currentPage: 0,
        limit: DEFAULT_SEARCH_LIMIT,
        count: 0,
      },
      data: [],
    });

    renderWithProps();

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();
    let noResultsAlert = document.querySelector('#no-results-alert');
    expect(noResultsAlert).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).not.toBeInTheDocument();
      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).toBeInTheDocument();
      expect(noResultsAlert).toBeVisible();
    });
  });

  test('should show the no results alert when no results at all are received', async () => {
    vi.spyOn(Api2, 'searchCases').mockResolvedValue();

    renderWithProps();

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();
    let noResultsAlert = document.querySelector('#no-results-alert');
    expect(noResultsAlert).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('.search-results table');
      expect(table).not.toBeInTheDocument();
      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).toBeInTheDocument();
      expect(noResultsAlert).toBeVisible();
    });
  });

  test('should show the generic error alert when a non-timeout error is encountered', async () => {
    vi.spyOn(Api2, 'searchCases').mockRejectedValue(new Error('SomeError'));

    renderWithProps();

    let table = document.querySelector('.search-results table');
    expect(table).not.toBeInTheDocument();

    let searchErrorAlert = document.querySelector('#search-error-alert');
    expect(searchErrorAlert).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
      searchErrorAlert = document.querySelector('#search-error-alert');
      expect(searchErrorAlert).toBeInTheDocument();
      expect(searchErrorAlert).toBeVisible();
      expect(searchErrorAlert).toHaveTextContent('Search results not available');
    });
  });

  test('should show the timeout error alert when a 504 error is encountered', async () => {
    vi.spyOn(Api2, 'searchCases').mockRejectedValue(new CamsHttpError(504, 'Gateway Timeout'));

    renderWithProps();

    let searchErrorAlert = document.querySelector('#search-error-alert');
    expect(searchErrorAlert).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      searchErrorAlert = document.querySelector('#search-error-alert');
      expect(searchErrorAlert).toBeInTheDocument();
      expect(searchErrorAlert).toBeVisible();
      expect(searchErrorAlert).toHaveTextContent('Unable to display search results');
      expect(searchErrorAlert).toHaveTextContent('Try narrowing your search filters');
    });
  });

  test('should render pagination', async () => {
    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      const pagination = document.querySelector('.usa-pagination');
      expect(pagination).toBeInTheDocument();
      expect(pagination).toBeVisible();
    });

    const nextPage = screen.getByTestId('pagination-button-next-results');
    fireEvent.click(nextPage);

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      const pagination = document.querySelector('.usa-pagination');
      expect(pagination).toBeInTheDocument();
      expect(pagination).toBeVisible();
    });
  });

  test('should not search for an invalid predicate', async () => {
    renderWithProps({
      searchPredicate: {
        limit: 25,
        offset: 0,
      },
    });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });
  });
});
