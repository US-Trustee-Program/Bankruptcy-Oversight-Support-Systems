import Api2 from '@/lib/models/api2';
import { SearchResultsHeader } from '@/search/SearchResultsHeader';
import { SearchResultsRow } from '@/search/SearchResultsRow';
import { CasesSearchPredicate, DEFAULT_SEARCH_LIMIT } from '@common/api/search';
import { SyncedCase } from '@common/cams/cases';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import { SearchResults, SearchResultsProps } from './SearchResults';

describe('SearchResults component tests', () => {
  let caseList: SyncedCase[];
  const onStartSearchingSpy = vi.fn();
  const onEndSearchingSpy = vi.fn();

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    caseList = MockData.buildArray(MockData.getSyncedCase, 60);
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: caseList,
      meta: {
        self: 'self-link',
      },
      pagination: {
        count: caseList.length,
        currentPage: 1,
        limit: DEFAULT_SEARCH_LIMIT,
        next: 'next-link',
        totalPages: Math.ceil(caseList.length / DEFAULT_SEARCH_LIMIT),
      },
    });
  });

  function renderWithProps(props: Partial<SearchResultsProps> = {}) {
    const defaultProps: SearchResultsProps = {
      header: SearchResultsHeader,
      id: 'search-results',
      onEndSearching: onEndSearchingSpy,
      onStartSearching: onStartSearchingSpy,
      row: SearchResultsRow,
      searchPredicate: {
        caseNumber: '00-11111',
        limit: 25,
        offset: 0,
      },
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
      data: [],
      meta: {
        self: 'self-link',
      },
      pagination: {
        count: 0,
        currentPage: 0,
        limit: DEFAULT_SEARCH_LIMIT,
      },
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

  test('should show the error alert when an error is encountered', async () => {
    vi.spyOn(Api2, 'searchCases').mockRejectedValue({
      error: { message: 'SomeError' },
    });

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
