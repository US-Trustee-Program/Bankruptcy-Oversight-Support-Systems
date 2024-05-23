import { MockData } from '@common/cams/test-utilities/mock-data';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { CaseSummary } from '@common/cams/cases';
import { render, waitFor, screen } from '@testing-library/react';
import { CasesSearchPredicate } from '@common/api/search';
import { SearchResults, SearchResultsProps } from './SearchResults';
import { BrowserRouter } from 'react-router-dom';

describe('SearchResults component tests', () => {
  let caseList: CaseSummary[];

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    caseList = [MockData.getCaseSummary(), MockData.getCaseSummary()];
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      isSuccess: true,
      meta: {
        isPaginated: true,
        count: caseList.length,
        next: 'next-link',
        self: 'self-link',
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

  test('should have no previous button', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      isSuccess: true,
      meta: {
        isPaginated: true,
        count: caseList.length,
        next: 'next-link',
        self: 'self-link',
      },
      data: caseList,
    });

    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    const nextButton = screen.queryByTestId('button-next-results');
    const previousButton = screen.queryByTestId('button-previous-results');

    expect(nextButton).toBeInTheDocument();
    expect(nextButton).toBeEnabled();
    expect(previousButton).not.toBeInTheDocument();
  });

  test('should have previous button', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      isSuccess: true,
      meta: {
        isPaginated: true,
        count: caseList.length,
        next: 'next-link',
        previous: 'previous-link',
        self: 'self-link',
      },
      data: caseList,
    });

    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    const nextButton = screen.queryByTestId('button-next-results');
    const previousButton = screen.queryByTestId('button-previous-results');

    expect(nextButton).toBeInTheDocument();
    expect(nextButton).toBeEnabled();
    expect(previousButton).toBeInTheDocument();
    expect(previousButton).toBeEnabled();
  });

  test('should have previous button and no next button', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      isSuccess: true,
      meta: {
        isPaginated: true,
        count: caseList.length,
        previous: 'previous-link',
        self: 'self-link',
      },
      data: caseList,
    });

    renderWithProps();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    const nextButton = screen.queryByTestId('button-next-results');
    const previousButton = screen.queryByTestId('button-previous-results');

    expect(nextButton).not.toBeInTheDocument();
    expect(previousButton).toBeInTheDocument();
    expect(previousButton).toBeEnabled();
  });

  test('should have page buttons numbered one and two', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({
      isSuccess: true,
      meta: {
        isPaginated: true,
        count: caseList.length,
        next: 'next-link',
        previous: 'previous-link',
        self: 'self-link',
        limit: 25,
        offset: 0,
      },
      data: caseList,
    });

    const caseNumber = '00-11111';
    const searchPredicate: CasesSearchPredicate = {
      caseNumber,
      limit: 25,
      offset: 25,
    };

    renderWithProps({ searchPredicate });

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });

    const nextButton = screen.queryByTestId('button-next-results');
    const previousButton = screen.queryByTestId('button-previous-results');
    const pageOneButton = screen.queryByTestId('button-page-1-results');
    const pageTwoButton = screen.queryByTestId('button-page-2-results');
    // const overflow = screen.queryByTestId('overflow-indicator-two');

    expect(nextButton).toBeInTheDocument();
    expect(nextButton).toBeEnabled();
    expect(previousButton).toBeInTheDocument();
    expect(previousButton).toBeEnabled();
    expect(pageOneButton).toBeInTheDocument();
    expect(pageOneButton).toBeEnabled();
    expect(pageTwoButton).toBeInTheDocument();
    expect(pageTwoButton).toBeEnabled();
    // expect(overflow).toBeInTheDocument();
  });
});
