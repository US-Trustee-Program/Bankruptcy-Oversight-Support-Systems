import { MockData } from '@common/cams/test-utilities/mock-data';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { CaseBasics, CaseSummary } from '@common/cams/cases';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CasesSearchPredicate } from '@common/api/search';
import { SearchResults, SearchResultsProps } from './SearchResults';
import { BrowserRouter } from 'react-router-dom';
import { buildResponseBodySuccess } from '@common/api/response';

describe('SearchResults component tests', () => {
  let caseList: CaseSummary[];
  const onStartSearchingSpy = vi.fn();
  const onEndSearchingSpy = vi.fn();

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    caseList = MockData.buildArray(MockData.getCaseSummary, 30);
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue(
      buildResponseBodySuccess<CaseBasics[]>(caseList, {
        next: 'next-link',
        self: 'self-link',
      }),
    );
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

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).toBeVisible();
    });

    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);
  });

  test('should show the no results alert when no results are available', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValueOnce({
      message: '',
      count: 0,
      body: [],
    });

    renderWithProps();

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();
    let noResultsAlert = document.querySelector('#no-results-alert');
    expect(noResultsAlert).not.toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).toBeInTheDocument();
      expect(noResultsAlert).toBeVisible();
    });
  });

  test('should show the error alert when an error is encountered', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockRejectedValueOnce({
      message: 'some error',
    });

    renderWithProps();

    let table = document.querySelector('#search-results > table');
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

    // TODO: click the next page...
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
