import { MockData } from '@common/cams/test-utilities/mock-data';
import { CaseBasics, CaseSummary } from '@common/cams/cases';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CasesSearchPredicate } from '@common/api/search';
import { SearchResults, SearchResultsProps, sortByCaseId, sortByDateFiled } from './SearchResults';
import { BrowserRouter } from 'react-router-dom';
import { buildResponseBodyError, buildResponseBodySuccess } from '@common/api/response';
import { SearchResultsHeader } from '@/search/SearchResultsHeader';
import { SearchResultsRow } from '@/search/SearchResultsRow';
import Api2 from '@/lib/hooks/UseApi2';

describe('SearchResults component tests', () => {
  let caseList: CaseSummary[];
  const onStartSearchingSpy = vi.fn();
  const onEndSearchingSpy = vi.fn();

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    caseList = MockData.buildArray(MockData.getCaseSummary, 30);
    const expectedResponse = buildResponseBodySuccess<CaseBasics[]>(caseList, {
      next: 'next-link',
      self: 'self-link',
    });
    vi.spyOn(Api2, 'searchCases').mockResolvedValue(expectedResponse);
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
    vi.spyOn(Api2, 'searchCases').mockResolvedValue(buildResponseBodySuccess([]));

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
    vi.spyOn(Api2, 'searchCases').mockRejectedValue(
      buildResponseBodyError(new Error('some error')),
    );

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

test('should sort objects properly by dateFiled', () => {
  const unsortedDates = [
    MockData.getCaseBasics({ override: { dateFiled: '2022-01-01' } }),
    MockData.getCaseBasics({ override: { dateFiled: '2020-01-01' } }),
    MockData.getCaseBasics({ override: { dateFiled: '2022-04-01' } }),
    MockData.getCaseBasics({ override: { dateFiled: '2024-09-15' } }),
    MockData.getCaseBasics({ override: { dateFiled: '2022-04-01' } }),
  ];

  const sortedDates = [
    MockData.getCaseBasics({ override: { dateFiled: '2024-09-15' } }),
    MockData.getCaseBasics({ override: { dateFiled: '2022-04-01' } }),
    MockData.getCaseBasics({ override: { dateFiled: '2022-04-01' } }),
    MockData.getCaseBasics({ override: { dateFiled: '2022-01-01' } }),
    MockData.getCaseBasics({ override: { dateFiled: '2020-01-01' } }),
  ];

  const finalDates = unsortedDates.sort(sortByDateFiled);

  for (let i = 0; i < finalDates.length; i++) {
    expect(finalDates[i].dateFiled).toEqual(sortedDates[i].dateFiled);
  }
});

describe('test sorting functions', () => {
  test('should sort objects properly by caseId', () => {
    const unsortedDates = [
      MockData.getCaseBasics({ override: { caseId: '20-22011' } }),
      MockData.getCaseBasics({ override: { caseId: '20-20011' } }),
      MockData.getCaseBasics({ override: { caseId: '20-22041' } }),
      MockData.getCaseBasics({ override: { caseId: '20-24095' } }),
      MockData.getCaseBasics({ override: { caseId: '20-22041' } }),
    ];

    const sortedDates = [
      MockData.getCaseBasics({ override: { caseId: '20-24095' } }),
      MockData.getCaseBasics({ override: { caseId: '20-22041' } }),
      MockData.getCaseBasics({ override: { caseId: '20-22041' } }),
      MockData.getCaseBasics({ override: { caseId: '20-22011' } }),
      MockData.getCaseBasics({ override: { caseId: '20-20011' } }),
    ];

    const finalDates = unsortedDates.sort(sortByCaseId);

    for (let i = 0; i < finalDates.length; i++) {
      expect(finalDates[i].caseId).toEqual(sortedDates[i].caseId);
    }
  });
});
